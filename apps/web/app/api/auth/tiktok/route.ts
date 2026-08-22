import { NextResponse } from "next/server";
import { createOAuthStateToken, encryptSecret } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { generateCodeChallenge, generateCodeVerifier, TIKTOK_OAUTH_COOKIE } from "@/lib/pkce";

export async function GET() {
  const env = serverEnv();
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Hanya owner atau editor yang dapat menghubungkan akun TikTok.");
    }
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
      throw new Error("Integrasi TikTok belum dikonfigurasi oleh administrator Routie.");
    }

    const redirectUri = env.TIKTOK_REDIRECT_URI || `${env.APP_URL}/api/auth/callback/tiktok`;
    const state = await createOAuthStateToken(
      {
        sub: session.sub,
        workspaceId: session.workspaceId,
        provider: "TIKTOK",
        intent: "TIKTOK",
        redirectUri
      },
      env.SESSION_SECRET
    );
    const codeVerifier = generateCodeVerifier();
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.search = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      // Authorize the two supported publishing paths once. The actual mode is
      // still controlled by Routie's safety flags and TikTok review status.
      scope: env.TIKTOK_SCOPES || "user.info.basic,video.upload,video.publish",
      response_type: "code",
      redirect_uri: redirectUri,
      state,
      code_challenge: generateCodeChallenge(codeVerifier),
      code_challenge_method: "S256"
    }).toString();

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(
      TIKTOK_OAUTH_COOKIE,
      encryptSecret(
        JSON.stringify({ state, codeVerifier }),
        env.ENVELOPE_MASTER_KEY,
        `oauth:tiktok:${session.sub}`
      ),
      {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
        priority: "high"
      }
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memulai login TikTok.";
    return NextResponse.redirect(new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL));
  }
}
