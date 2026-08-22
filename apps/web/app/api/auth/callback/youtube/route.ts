import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { channelVariants, createDatabase, publishJobs, socialConnections, withTenant } from "@routie/db";
import { encryptSecret } from "@routie/security";
import { serverEnv } from "@/lib/env";
import { YOUTUBE_OAUTH_COOKIE } from "@/lib/pkce";
import { publishingQueue } from "@/lib/queue";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface YouTubeChannelsResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      customUrl?: string;
    };
  }>;
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const searchParams = request.nextUrl.searchParams;

  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  if (errorParam) {
    const errorMsg = errorDesc || errorParam;
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(`Google Auth Ditolak: ${errorMsg}`)}`, env.APP_URL)
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Parameter otentikasi Google YouTube tidak lengkap.")}`, env.APP_URL)
    );
  }

  // Retrieve OAuth state from cookie
  const cookieVal = request.cookies.get(YOUTUBE_OAUTH_COOKIE)?.value;
  if (!cookieVal) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Sesi otentikasi YouTube telah kedaluwarsa. Silakan coba lagi.")}`, env.APP_URL)
    );
  }

  let oauthData: { state: string; codeVerifier: string; workspaceId: string; redirectUri: string };
  try {
    const jsonStr = Buffer.from(cookieVal, "base64url").toString("utf-8");
    oauthData = JSON.parse(jsonStr);
  } catch {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Data sesi otentikasi YouTube rusak.")}`, env.APP_URL)
    );
  }

  if (oauthData.state !== state) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Verifikasi keamanan CSRF (State mismatch) gagal.")}`, env.APP_URL)
    );
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent("Kredensial GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum lengkap.")}`, env.APP_URL)
    );
  }

  try {
    // Exchange Authorization Code for Access & Refresh Token
    const tokenRequestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: oauthData.redirectUri,
      code_verifier: oauthData.codeVerifier
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: tokenRequestBody.toString()
    });

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || tokenData.error) {
      const errMsg = tokenData.error_description || tokenData.error || "Gagal menukar authorization code dengan Google.";
      return NextResponse.redirect(
        new URL(`/settings/connectors?error=${encodeURIComponent(`Otorisasi Google Gagal: ${errMsg}`)}`, env.APP_URL)
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL(`/settings/connectors?error=${encodeURIComponent("Google tidak mengembalikan access token.")}`, env.APP_URL)
      );
    }

    // Fetch YouTube channel details
    let accountName = "YouTube Channel";
    let channelId = `yt_${Date.now()}`;
    try {
      const channelResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (channelResponse.ok) {
        const channelData = (await channelResponse.json()) as YouTubeChannelsResponse;
        const item = channelData.items?.[0];
        if (item && item.snippet) {
          channelId = item.id;
          if (item.snippet.customUrl) {
            accountName = item.snippet.customUrl.startsWith("@")
              ? item.snippet.customUrl
              : `@${item.snippet.customUrl}`;
          } else if (item.snippet.title) {
            accountName = `@${item.snippet.title}`;
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }

    // Encrypt tokens securely using envelope encryption
    const encryptedAccessToken = encryptSecret(
      accessToken,
      env.ENVELOPE_MASTER_KEY,
      `${oauthData.workspaceId}:YOUTUBE:access-token`
    );

    const encryptedRefreshToken = refreshToken
      ? encryptSecret(
          refreshToken,
          env.ENVELOPE_MASTER_KEY,
          `${oauthData.workspaceId}:YOUTUBE:refresh-token`
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
            eq(socialConnections.channel, "YOUTUBE")
          )
        )
        .limit(1);

      if (existing[0]) {
        await tx
          .update(socialConnections)
          .set({
            externalAccountId: channelId,
            accountName,
            encryptedAccessToken,
            ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
            tokenExpiresAt,
            disconnectedAt: null,
            reauthorizationRequiredAt: null,
            reauthorizationReason: null,
            updatedAt: new Date()
          })
          .where(eq(socialConnections.id, existing[0].id));
      } else {
        await tx.insert(socialConnections).values({
          workspaceId: oauthData.workspaceId,
          channel: "YOUTUBE",
          deliveryMode: "AUTO_PUBLISH",
          externalAccountId: channelId,
          accountName,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          connectedAt: new Date()
        });
      }
      const heldJobs = await tx
        .select({ id: publishJobs.id })
        .from(publishJobs)
        .innerJoin(channelVariants, eq(channelVariants.id, publishJobs.variantId))
        .where(and(
          eq(publishJobs.workspaceId, oauthData.workspaceId),
          eq(publishJobs.status, "HELD"),
          eq(publishJobs.heldReason, "SOCIAL_RECONNECT_REQUIRED"),
          eq(channelVariants.channel, "YOUTUBE")
        ));

      if (heldJobs.length > 0) {
        await tx
          .update(publishJobs)
          .set({ status: "QUEUED", heldReason: null, lastError: null, updatedAt: new Date() })
          .where(and(eq(publishJobs.workspaceId, oauthData.workspaceId), inArray(publishJobs.id, heldJobs.map((job) => job.id))));
        const queue = publishingQueue();
        await Promise.all(heldJobs.map((job) => queue.add("publish", {
          workspaceId: oauthData.workspaceId,
          publishJobId: job.id
        }, { jobId: job.id })));
      }
    });

    const response = NextResponse.redirect(new URL("/settings/connectors?connected=YOUTUBE", env.APP_URL));
    response.cookies.delete(YOUTUBE_OAUTH_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat menghubungkan YouTube.";
    const response = NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL)
    );
    response.cookies.delete(YOUTUBE_OAUTH_COOKIE);
    return response;
  }
}
