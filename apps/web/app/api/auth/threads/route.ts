import { NextResponse } from "next/server";
import { createOAuthStateToken } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { THREADS_OAUTH_COOKIE } from "@/lib/pkce";

export async function GET() {
  const env = serverEnv();
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Hanya owner atau editor yang dapat menghubungkan akun Threads.");
    }
    if (!env.THREADS_APP_ID || !env.THREADS_APP_SECRET) {
      throw new Error("Integrasi Threads belum dikonfigurasi oleh administrator Routie.");
    }

    const redirectUri = env.THREADS_REDIRECT_URI || `${env.APP_URL}/api/auth/callback/threads`;
    const state = await createOAuthStateToken(
      {
        sub: session.sub,
        workspaceId: session.workspaceId,
        provider: "THREADS",
        intent: "THREADS",
        redirectUri
      },
      env.SESSION_SECRET
    );
    const authUrl = new URL("https://threads.net/oauth/authorize");
    authUrl.search = new URLSearchParams({
      client_id: env.THREADS_APP_ID,
      redirect_uri: redirectUri,
      scope: "threads_basic,threads_content_publish",
      response_type: "code",
      state
    }).toString();

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(THREADS_OAUTH_COOKIE, state, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
      priority: "high"
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memulai login Threads.";
    return NextResponse.redirect(new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL));
  }
}
