import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { generateCodeChallenge, generateCodeVerifier, generateState, YOUTUBE_OAUTH_COOKIE } from "@/lib/pkce";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Hanya owner atau editor yang dapat menghubungkan akun YouTube.");
    }

    const env = serverEnv();
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi di environment (.env).");
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const redirectUri =
      env.YOUTUBE_REDIRECT_URI || env.GOOGLE_REDIRECT_URI || `${env.APP_URL}/api/auth/callback/youtube`;

    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile"
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
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

    response.cookies.set(YOUTUBE_OAUTH_COOKIE, Buffer.from(oauthPayload).toString("base64url"), {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 // 10 minutes
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memulai otentikasi YouTube";
    const env = serverEnv();
    return NextResponse.redirect(new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL));
  }
}
