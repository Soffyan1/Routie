import { NextRequest, NextResponse } from "next/server";
import { createDatabase } from "@routie/db";
import { decryptSecret, verifyOAuthStateToken } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { TIKTOK_OAUTH_COOKIE } from "@/lib/pkce";
import { persistTikTokConnection } from "@/lib/social-connection-store";
import { resumeHeldSocialPublishJobs } from "@/lib/social-publish-resume";

type TikTokTokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_token?: string;
  error?: { code?: string | number; message?: string };
  error_description?: string;
};

type TikTokUserInfoResponse = {
  data?: { user?: { display_name?: string; username?: string } };
  error?: { code?: string | number; message?: string };
};

function connectorRedirect(appUrl: string, params: Record<string, string>): URL {
  const url = new URL("/settings/connectors", appUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function withClearedCookie(response: NextResponse): NextResponse {
  response.cookies.delete(TIKTOK_OAUTH_COOKIE);
  return response;
}

function isTikTokError(payload: TikTokTokenResponse | TikTokUserInfoResponse): boolean {
  const code = payload.error?.code;
  return code !== undefined && code !== "ok" && code !== "0" && code !== 0;
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  if (request.nextUrl.searchParams.get("error")) {
    return withClearedCookie(
      NextResponse.redirect(connectorRedirect(env.APP_URL, { error: "Login TikTok dibatalkan. Akun belum terhubung." }))
    );
  }

  try {
    const session = await requireSession();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const sealed = request.cookies.get(TIKTOK_OAUTH_COOKIE)?.value;
    if (!code || !state || !sealed) {
      throw new Error("Sesi login TikTok tidak lengkap atau sudah kedaluwarsa. Silakan coba lagi.");
    }
    const saved = JSON.parse(
      decryptSecret(sealed, env.ENVELOPE_MASTER_KEY, `oauth:tiktok:${session.sub}`)
    ) as { state?: string; codeVerifier?: string };
    if (!saved.state || !saved.codeVerifier || saved.state !== state) {
      throw new Error("Sesi login TikTok tidak valid. Silakan coba lagi.");
    }
    const oauth = await verifyOAuthStateToken(state, env.SESSION_SECRET);
    if (
      oauth.provider !== "TIKTOK" ||
      oauth.intent !== "TIKTOK" ||
      oauth.sub !== session.sub ||
      oauth.workspaceId !== session.workspaceId
    ) {
      throw new Error("Login TikTok tidak cocok dengan user atau workspace aktif.");
    }
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
      throw new Error("Integrasi TikTok belum dikonfigurasi oleh administrator Routie.");
    }

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: oauth.redirectUri,
        code_verifier: saved.codeVerifier
      }).toString(),
      signal: AbortSignal.timeout(30_000)
    });
    const token = (await tokenResponse.json().catch(() => ({}))) as TikTokTokenResponse;
    if (!tokenResponse.ok || isTikTokError(token) || !token.access_token || !token.open_id) {
      throw new Error("TikTok belum dapat menyelesaikan koneksi akun. Silakan coba lagi beberapa saat.");
    }

    let accountName = `@tiktok_${token.open_id.slice(-6)}`;
    try {
      const profileResponse = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
        { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000) }
      );
      const profile = (await profileResponse.json().catch(() => ({}))) as TikTokUserInfoResponse;
      const user = !isTikTokError(profile) ? profile.data?.user : null;
      if (user?.username) accountName = `@${user.username.replace(/^@/, "")}`;
      else if (user?.display_name) accountName = user.display_name;
    } catch {
      // Profile display data is optional; the connection itself remains valid.
    }

    const db = createDatabase(env.DATABASE_URL);
    await persistTikTokConnection({
      db,
      workspaceId: session.workspaceId,
      actorId: session.sub,
      masterKey: env.ENVELOPE_MASTER_KEY,
      openId: token.open_id,
      accountName,
      accessToken: token.access_token,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
      tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 86_400) * 1_000)
    });
    await resumeHeldSocialPublishJobs(db, session.workspaceId, ["TIKTOK"]);
    return withClearedCookie(NextResponse.redirect(connectorRedirect(env.APP_URL, { connected: "TikTok" })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyelesaikan login TikTok.";
    return withClearedCookie(NextResponse.redirect(connectorRedirect(env.APP_URL, { error: message })));
  }
}
