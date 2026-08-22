import { NextRequest, NextResponse } from "next/server";
import { createDatabase } from "@routie/db";
import { verifyOAuthStateToken } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { exchangeThreadsAuthorizationCode, getThreadsProfile } from "@/lib/meta-oauth";
import { THREADS_OAUTH_COOKIE } from "@/lib/pkce";
import { persistThreadsConnection } from "@/lib/social-connection-store";
import { resumeHeldSocialPublishJobs } from "@/lib/social-publish-resume";

function connectorRedirect(appUrl: string, params: Record<string, string>): URL {
  const url = new URL("/settings/connectors", appUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const providerError = request.nextUrl.searchParams.get("error_message") || request.nextUrl.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(connectorRedirect(env.APP_URL, { error: `Login Threads dibatalkan: ${providerError}` }));
  }

  try {
    const session = await requireSession();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const cookieState = request.cookies.get(THREADS_OAUTH_COOKIE)?.value;
    if (!code || !state || !cookieState || state !== cookieState) {
      throw new Error("Sesi login Threads tidak valid atau sudah kedaluwarsa. Silakan coba lagi.");
    }
    const oauth = await verifyOAuthStateToken(state, env.SESSION_SECRET);
    if (
      oauth.provider !== "THREADS" ||
      oauth.intent !== "THREADS" ||
      oauth.sub !== session.sub ||
      oauth.workspaceId !== session.workspaceId
    ) {
      throw new Error("Login Threads tidak cocok dengan user atau workspace aktif.");
    }
    if (!env.THREADS_APP_ID || !env.THREADS_APP_SECRET) {
      throw new Error("Kredensial Threads belum dikonfigurasi.");
    }

    const token = await exchangeThreadsAuthorizationCode({
      code,
      redirectUri: oauth.redirectUri,
      appId: env.THREADS_APP_ID,
      appSecret: env.THREADS_APP_SECRET
    });
    const profile = await getThreadsProfile(token.accessToken);
    if (!profile.id) throw new Error("Threads tidak mengembalikan identitas akun.");
    const db = createDatabase(env.DATABASE_URL);
    await persistThreadsConnection({
      db,
      workspaceId: session.workspaceId,
      actorId: session.sub,
      masterKey: env.ENVELOPE_MASTER_KEY,
      profile,
      accessToken: token.accessToken,
      tokenExpiresAt: token.expiresAt
    });
    await resumeHeldSocialPublishJobs(db, session.workspaceId, ["THREADS"]);
    const response = NextResponse.redirect(connectorRedirect(env.APP_URL, { connected: "Threads" }));
    response.cookies.delete(THREADS_OAUTH_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyelesaikan login Threads.";
    const response = NextResponse.redirect(connectorRedirect(env.APP_URL, { error: message }));
    response.cookies.delete(THREADS_OAUTH_COOKIE);
    return response;
  }
}
