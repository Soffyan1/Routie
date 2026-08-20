import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { generateCodeChallenge, generateCodeVerifier, generateState, TIKTOK_OAUTH_COOKIE } from "@/lib/pkce";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Hanya owner atau editor yang dapat menghubungkan akun sosial media.");
    }

    const env = serverEnv();
    const clientKey = env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      throw new Error("TIKTOK_CLIENT_KEY belum dikonfigurasi di environment (.env).");
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const redirectUri = env.TIKTOK_REDIRECT_URI || `${env.APP_URL}/api/auth/callback/tiktok`;

    // TikTok Login Kit scope (defaults to user.info.basic for unreviewed/draft apps)
    const scopes = process.env.TIKTOK_SCOPES || "user.info.basic";

    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authUrl.toString());

    // Store state and code_verifier securely in an httpOnly cookie for 10 minutes
    const oauthPayload = JSON.stringify({
      state,
      codeVerifier,
      workspaceId: session.workspaceId,
      redirectUri
    });

    response.cookies.set(TIKTOK_OAUTH_COOKIE, Buffer.from(oauthPayload).toString("base64url"), {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 // 10 minutes
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memulai otentikasi TikTok";
    const env = serverEnv();
    return NextResponse.redirect(new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL));
  }
}
