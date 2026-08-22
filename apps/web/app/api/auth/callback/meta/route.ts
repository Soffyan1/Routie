import { NextRequest, NextResponse } from "next/server";
import { createDatabase } from "@routie/db";
import { verifyOAuthStateToken } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import {
  exchangeMetaAuthorizationCode,
  getInstagramProfile,
  getMetaTokenExpiry,
  listMetaPages,
  sealMetaSelection
} from "@/lib/meta-oauth";
import { META_OAUTH_COOKIE, META_SELECTION_COOKIE } from "@/lib/pkce";
import { persistMetaPageConnections } from "@/lib/social-connection-store";
import { resumeHeldSocialPublishJobs } from "@/lib/social-publish-resume";

function connectorRedirect(appUrl: string, params: Record<string, string>): URL {
  const url = new URL("/settings/connectors", appUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const providerError = request.nextUrl.searchParams.get("error_description") || request.nextUrl.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(connectorRedirect(env.APP_URL, { error: `Login Meta dibatalkan: ${providerError}` }));
  }

  try {
    const session = await requireSession();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const cookieState = request.cookies.get(META_OAUTH_COOKIE)?.value;
    if (!code || !state || !cookieState || state !== cookieState) {
      throw new Error("Sesi login Meta tidak valid atau sudah kedaluwarsa. Silakan coba lagi.");
    }
    const oauth = await verifyOAuthStateToken(state, env.SESSION_SECRET);
    if (
      oauth.provider !== "META" ||
      oauth.sub !== session.sub ||
      oauth.workspaceId !== session.workspaceId
    ) {
      throw new Error("Login Meta tidak cocok dengan user atau workspace aktif.");
    }
    if (oauth.intent !== "FACEBOOK" && oauth.intent !== "INSTAGRAM") {
      throw new Error("Tujuan login Meta tidak valid.");
    }
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new Error("Kredensial Meta belum dikonfigurasi.");
    }

    const token = await exchangeMetaAuthorizationCode({
      code,
      redirectUri: oauth.redirectUri,
      appId: env.META_APP_ID,
      appSecret: env.META_APP_SECRET,
      version: env.META_GRAPH_API_VERSION
    });
    const discovered = await listMetaPages(token.accessToken, env.META_GRAPH_API_VERSION);
    const pages = oauth.intent === "INSTAGRAM"
      ? discovered.filter((page) => Boolean(page.instagram_business_account?.id))
      : discovered;
    if (pages.length === 0) {
      throw new Error(
        oauth.intent === "INSTAGRAM"
          ? "Tidak ditemukan akun Instagram Professional yang terhubung ke Facebook Page yang Anda kelola."
          : "Tidak ditemukan Facebook Page yang dapat Anda kelola dan publikasikan."
      );
    }

    if (pages.length > 1) {
      const response = NextResponse.redirect(connectorRedirect(env.APP_URL, { meta_select: "1" }));
      response.cookies.delete(META_OAUTH_COOKIE);
      response.cookies.set(
        META_SELECTION_COOKIE,
        sealMetaSelection(
          {
            actorId: session.sub,
            workspaceId: session.workspaceId,
            intent: oauth.intent,
            accessToken: token.accessToken,
            tokenExpiresAt: token.expiresAt.toISOString(),
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
          },
          env.ENVELOPE_MASTER_KEY
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
    }

    const page = pages[0]!;
    const instagramId = page.instagram_business_account?.id;
    let instagramProfile;
    if (instagramId) {
      try {
        instagramProfile = await getInstagramProfile(
          instagramId,
          page.access_token,
          env.META_GRAPH_API_VERSION
        );
      } catch (error) {
        // Connecting a Facebook Page must still succeed if its optional linked
        // Instagram profile is temporarily unavailable. An Instagram-initiated
        // connection still requires the profile and surfaces the real error.
        if (oauth.intent === "INSTAGRAM") throw error;
      }
    }
    const pageTokenExpiresAt = await getMetaTokenExpiry({
      pageAccessToken: page.access_token,
      appId: env.META_APP_ID,
      appSecret: env.META_APP_SECRET,
      version: env.META_GRAPH_API_VERSION,
      fallback: token.expiresAt
    });
    const db = createDatabase(env.DATABASE_URL);
    const connected = await persistMetaPageConnections({
      db,
      workspaceId: session.workspaceId,
      actorId: session.sub,
      masterKey: env.ENVELOPE_MASTER_KEY,
      page,
      ...(instagramProfile ? { instagramProfile } : {}),
      tokenExpiresAt: pageTokenExpiresAt
    });
    await resumeHeldSocialPublishJobs(
      db,
      session.workspaceId,
      connected.instagram ? ["FACEBOOK", "INSTAGRAM"] : ["FACEBOOK"]
    );
    const response = NextResponse.redirect(
      connectorRedirect(env.APP_URL, {
        connected: connected.instagram ? "Facebook dan Instagram" : "Facebook"
      })
    );
    response.cookies.delete(META_OAUTH_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyelesaikan login Meta.";
    const response = NextResponse.redirect(connectorRedirect(env.APP_URL, { error: message }));
    response.cookies.delete(META_OAUTH_COOKIE);
    return response;
  }
}
