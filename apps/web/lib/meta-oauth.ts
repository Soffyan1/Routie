import { z } from "zod";
import { decryptSecret, encryptSecret } from "@routie/security";

type MetaApiErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
  error_message?: string;
  error_code?: number;
};

export interface MetaPageAccount {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
  instagram_business_account?: { id: string };
}

export interface InstagramProfile {
  id: string;
  username?: string;
  name?: string;
}

export interface ThreadsProfile {
  id: string;
  username?: string;
  name?: string;
}

const metaSelectionSchema = z.object({
  actorId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  intent: z.enum(["FACEBOOK", "INSTAGRAM"]),
  accessToken: z.string().min(1),
  tokenExpiresAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});

export type MetaSelection = z.infer<typeof metaSelectionSchema>;

async function apiJson<T>(response: Response, label: string): Promise<T> {
  const raw = await response.text();
  let payload: T & MetaApiErrorBody;
  try {
    payload = JSON.parse(raw) as T & MetaApiErrorBody;
  } catch {
    throw new Error(`${label} mengirim respons yang tidak dapat dibaca.`);
  }
  if (!response.ok || payload.error || payload.error_code) {
    const message = payload.error?.message || payload.error_message || `${label} gagal (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function exchangeMetaAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
  version: string;
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const shortUrl = new URL(`https://graph.facebook.com/${input.version}/oauth/access_token`);
  shortUrl.search = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    redirect_uri: input.redirectUri,
    code: input.code
  }).toString();
  const shortResponse = await fetch(shortUrl, { signal: AbortSignal.timeout(30_000) });
  const shortToken = await apiJson<{ access_token?: string }>(shortResponse, "Otorisasi Meta");
  if (!shortToken.access_token) throw new Error("Meta tidak mengembalikan access token.");

  const longUrl = new URL(`https://graph.facebook.com/${input.version}/oauth/access_token`);
  longUrl.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: input.appId,
    client_secret: input.appSecret,
    fb_exchange_token: shortToken.access_token
  }).toString();
  const longResponse = await fetch(longUrl, { signal: AbortSignal.timeout(30_000) });
  const longToken = await apiJson<{ access_token?: string; expires_in?: number }>(longResponse, "Token Meta");
  if (!longToken.access_token) throw new Error("Meta tidak mengembalikan long-lived access token.");
  return {
    accessToken: longToken.access_token,
    expiresAt: new Date(Date.now() + (longToken.expires_in ?? 5_184_000) * 1_000)
  };
}

export async function listMetaPages(accessToken: string, version: string): Promise<MetaPageAccount[]> {
  const url = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  url.search = new URLSearchParams({
    fields: "id,name,access_token,tasks,instagram_business_account{id}",
    limit: "100",
    access_token: accessToken
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const payload = await apiJson<{ data?: MetaPageAccount[] }>(response, "Daftar Facebook Page");
  return (payload.data ?? []).filter(
    (page) => Boolean(page.id && page.name && page.access_token) && (!page.tasks || page.tasks.includes("CREATE_CONTENT") || page.tasks.includes("MANAGE"))
  );
}

export async function getInstagramProfile(
  instagramId: string,
  pageAccessToken: string,
  version: string
): Promise<InstagramProfile> {
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(instagramId)}`);
  url.search = new URLSearchParams({ fields: "id,username,name", access_token: pageAccessToken }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  return apiJson<InstagramProfile>(response, "Profil Instagram");
}

export async function getMetaTokenExpiry(input: {
  pageAccessToken: string;
  appId: string;
  appSecret: string;
  version: string;
  fallback: Date;
}): Promise<Date | null> {
  try {
    const url = new URL(`https://graph.facebook.com/${input.version}/debug_token`);
    url.search = new URLSearchParams({
      input_token: input.pageAccessToken,
      access_token: `${input.appId}|${input.appSecret}`
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const payload = await apiJson<{
      data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number }
    }>(response, "Validasi token Meta");
    if (payload.data?.is_valid === false) throw new Error("Token Facebook Page tidak valid.");
    const expirations = [payload.data?.expires_at, payload.data?.data_access_expires_at]
      .filter((value): value is number => typeof value === "number" && value > 0)
      .map((value) => new Date(value * 1_000))
      .filter((value) => value.getTime() > Date.now());
    return expirations.length > 0
      ? new Date(Math.min(...expirations.map((value) => value.getTime())))
      : null;
  } catch {
    // Token debugging is a health enhancement; a transient debugger failure must not break OAuth.
    return input.fallback;
  }
}

export async function exchangeThreadsAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const body = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri
  });
  const shortResponse = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(30_000)
  });
  const shortToken = await apiJson<{ access_token?: string }>(shortResponse, "Otorisasi Threads");
  if (!shortToken.access_token) throw new Error("Threads tidak mengembalikan access token.");

  const longUrl = new URL("https://graph.threads.net/access_token");
  longUrl.search = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: input.appSecret,
    access_token: shortToken.access_token
  }).toString();
  const longResponse = await fetch(longUrl, { signal: AbortSignal.timeout(30_000) });
  const longToken = await apiJson<{ access_token?: string; expires_in?: number }>(longResponse, "Token Threads");
  if (!longToken.access_token) throw new Error("Threads tidak mengembalikan long-lived access token.");
  return {
    accessToken: longToken.access_token,
    expiresAt: new Date(Date.now() + (longToken.expires_in ?? 5_184_000) * 1_000)
  };
}

export async function getThreadsProfile(accessToken: string): Promise<ThreadsProfile> {
  const url = new URL("https://graph.threads.net/v1.0/me");
  url.search = new URLSearchParams({ fields: "id,username,name", access_token: accessToken }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  return apiJson<ThreadsProfile>(response, "Profil Threads");
}

export function sealMetaSelection(selection: MetaSelection, masterKey: string): string {
  return encryptSecret(JSON.stringify(metaSelectionSchema.parse(selection)), masterKey, "oauth:meta:selection");
}

export function openMetaSelection(value: string, masterKey: string): MetaSelection {
  const selection = metaSelectionSchema.parse(
    JSON.parse(decryptSecret(value, masterKey, "oauth:meta:selection"))
  );
  if (new Date(selection.expiresAt).getTime() <= Date.now()) throw new Error("Pilihan akun Meta telah kedaluwarsa.");
  return selection;
}

export function accountLabel(name: string | undefined, username: string | undefined, fallback: string): string {
  if (username) return `@${username.replace(/^@/, "")}`;
  return name?.trim() || fallback;
}
