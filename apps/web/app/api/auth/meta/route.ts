import { NextRequest, NextResponse } from "next/server";
import { createOAuthStateToken } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { META_OAUTH_COOKIE } from "@/lib/pkce";

export async function GET(request: NextRequest) {
  const env = serverEnv();
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Hanya owner atau editor yang dapat menghubungkan akun Meta.");
    }
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new Error("Integrasi Meta belum dikonfigurasi oleh administrator Routie.");
    }

    const requestedChannel = request.nextUrl.searchParams.get("channel");
    const intent = requestedChannel === "FACEBOOK" ? "FACEBOOK" : "INSTAGRAM";
    const redirectUri = env.META_REDIRECT_URI || `${env.APP_URL}/api/auth/callback/meta`;
    const state = await createOAuthStateToken(
      {
        sub: session.sub,
        workspaceId: session.workspaceId,
        provider: "META",
        intent,
        redirectUri
      },
      env.SESSION_SECRET
    );

    const authUrl = new URL(`https://www.facebook.com/${env.META_GRAPH_API_VERSION}/dialog/oauth`);
    authUrl.search = new URLSearchParams({
      client_id: env.META_APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: [
        "pages_show_list",
        "pages_manage_posts",
        "pages_read_engagement",
        "instagram_basic",
        "instagram_content_publish"
      ].join(","),
      auth_type: "rerequest"
    }).toString();

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(META_OAUTH_COOKIE, state, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
      priority: "high"
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memulai login Meta.";
    return NextResponse.redirect(new URL(`/settings/connectors?error=${encodeURIComponent(message)}`, env.APP_URL));
  }
}
