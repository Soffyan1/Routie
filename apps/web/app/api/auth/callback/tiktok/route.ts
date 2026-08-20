import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createDatabase, socialConnections, withTenant } from "@routie/db";
import { encryptSecret } from "@routie/security";
import { serverEnv } from "@/lib/env";
import { TIKTOK_OAUTH_COOKIE } from "@/lib/pkce";

interface TikTokTokenResponse {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  data?: {
    access_token?: string;
    expires_in?: number;
    open_id?: string;
    refresh_expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
  error_description?: string;
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      avatar_url?: string;
      display_name?: string;
      username?: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const searchParams = request.nextUrl.searchParams;

  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  if (errorParam) {
    const errorMsg = errorDesc || errorParam;
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(`TikTok Auth Ditolak: ${errorMsg}`)}`, env.APP_URL)
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Parameter otentikasi TikTok tidak lengkap.")}`, env.APP_URL)
    );
  }

  // Retrieve OAuth state from cookie
  const cookieVal = request.cookies.get(TIKTOK_OAUTH_COOKIE)?.value;
  if (!cookieVal) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Sesi otentikasi TikTok telah kedaluwarsa. Silakan coba lagi.")}`, env.APP_URL)
    );
  }

  let oauthData: { state: string; codeVerifier: string; workspaceId: string; redirectUri: string };
  try {
    const jsonStr = Buffer.from(cookieVal, "base64url").toString("utf-8");
    oauthData = JSON.parse(jsonStr);
  } catch {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Data sesi otentikasi TikTok rusak.")}`, env.APP_URL)
    );
  }

  if (oauthData.state !== state) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Verifikasi keamanan CSRF (State mismatch) gagal.")}`, env.APP_URL)
    );
  }

  const clientKey = env.TIKTOK_CLIENT_KEY;
  const clientSecret = env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Kredensial TikTok belum lengkap di server.")}`, env.APP_URL)
    );
  }

  try {
    // Exchange Authorization Code for Access Token (PKCE)
    const tokenRequestBody = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: oauthData.redirectUri,
      code_verifier: oauthData.codeVerifier
    });

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache"
      },
      body: tokenRequestBody.toString()
    });

    const tokenData = (await tokenResponse.json()) as TikTokTokenResponse;

    // Handle token error responses
    if (!tokenResponse.ok || (tokenData.error && tokenData.error.code !== "ok" && tokenData.error.code !== "0")) {
      const errMsg = tokenData.error?.message || tokenData.error_description || "Gagal menukar token dengan TikTok.";
      return NextResponse.redirect(
        new URL(`/settings/connectors?error=${encodeURIComponent(`Otorisasi TikTok Gagal: ${errMsg}`)}`, env.APP_URL)
      );
    }

    const payload = tokenData.data || tokenData;
    const accessToken = payload.access_token;
    const refreshToken = payload.refresh_token;
    const openId = payload.open_id;
    const expiresIn = payload.expires_in || 86400; // default 24h

    if (!accessToken || !openId) {
      return NextResponse.redirect(
        new URL(`/settings/connectors?error=${encodeURIComponent("TikTok tidak mengembalikan access token atau OpenID.")}`, env.APP_URL)
      );
    }

    // Attempt to fetch TikTok profile for friendly display name
    let accountName = `@tiktok_user_${openId.slice(-6)}`;
    try {
      const userInfoResponse = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (userInfoResponse.ok) {
        const userInfo = (await userInfoResponse.json()) as TikTokUserInfoResponse;
        const user = userInfo.data?.user;
        if (user?.display_name) {
          accountName = `@${user.display_name}`;
        } else if (user?.username) {
          accountName = `@${user.username}`;
        }
      }
    } catch {
      // Non-blocking: fallback accountName will be used
    }

    // Encrypt tokens securely using envelope encryption
    const encryptedAccessToken = encryptSecret(
      accessToken,
      env.ENVELOPE_MASTER_KEY,
      `${oauthData.workspaceId}:TIKTOK:access-token`
    );

    const encryptedRefreshToken = refreshToken
      ? encryptSecret(
          refreshToken,
          env.ENVELOPE_MASTER_KEY,
          `${oauthData.workspaceId}:TIKTOK:refresh-token`
        )
      : null;

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Save to socialConnections table
    const db = createDatabase(env.DATABASE_URL);
    await withTenant(db, oauthData.workspaceId, async (tx) => {
      const existing = await tx
        .select()
        .from(socialConnections)
        .where(
          and(
            eq(socialConnections.workspaceId, oauthData.workspaceId),
            eq(socialConnections.channel, "TIKTOK")
          )
        )
        .limit(1);

      if (existing[0]) {
        await tx
          .update(socialConnections)
          .set({
            externalAccountId: openId,
            accountName,
            encryptedAccessToken,
            encryptedRefreshToken,
            tokenExpiresAt,
            disconnectedAt: null,
            updatedAt: new Date()
          })
          .where(eq(socialConnections.id, existing[0].id));
      } else {
        await tx.insert(socialConnections).values({
          workspaceId: oauthData.workspaceId,
          channel: "TIKTOK",
          deliveryMode: "AUTO_PUBLISH",
          externalAccountId: openId,
          accountName,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          connectedAt: new Date()
        });
      }
    });

    // Clean up oauth cookie and redirect to connectors page with success status
    const response = NextResponse.redirect(new URL("/settings/connectors?connected=TIKTOK", env.APP_URL));
    response.cookies.delete(TIKTOK_OAUTH_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal saat menghubungkan TikTok.";
    const response = NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL)
    );
    response.cookies.delete(TIKTOK_OAUTH_COOKIE);
    return response;
  }
}
