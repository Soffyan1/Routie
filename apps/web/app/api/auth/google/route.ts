import { NextRequest, NextResponse } from "next/server";
import { generateCodeChallenge, generateCodeVerifier, generateState, GOOGLE_LOGIN_OAUTH_COOKIE } from "@/lib/pkce";
import { serverEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const env = serverEnv();

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/login?error=Google+OAuth+belum+dikonfigurasi+di+server.", env.APP_URL)
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const redirectUri = `${env.APP_URL}/api/auth/callback/google`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account"
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.redirect(googleAuthUrl);

  const cookiePayload = JSON.stringify({
    state,
    codeVerifier,
    redirectUri
  });

  response.cookies.set(GOOGLE_LOGIN_OAUTH_COOKIE, cookiePayload, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600 // 10 minutes
  });

  return response;
}
