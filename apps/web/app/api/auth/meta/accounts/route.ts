import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { getInstagramProfile, getMetaTokenExpiry, listMetaPages, openMetaSelection } from "@/lib/meta-oauth";
import { META_SELECTION_COOKIE } from "@/lib/pkce";
import { persistMetaPageConnections } from "@/lib/social-connection-store";
import { resumeHeldSocialPublishJobs } from "@/lib/social-publish-resume";
import { apiError } from "@/lib/http";

const selectionSchema = z.object({ pageId: z.string().min(1).max(100) });

async function selectionContext(request: NextRequest) {
  const session = await requireSession();
  const env = serverEnv();
  const cookie = request.cookies.get(META_SELECTION_COOKIE)?.value;
  if (!cookie) throw new Error("Sesi pilihan akun Meta telah kedaluwarsa. Silakan hubungkan akun lagi.");
  const selection = openMetaSelection(cookie, env.ENVELOPE_MASTER_KEY);
  if (selection.actorId !== session.sub || selection.workspaceId !== session.workspaceId) {
    throw new Error("Pilihan akun Meta tidak cocok dengan workspace aktif.");
  }
  const discovered = await listMetaPages(selection.accessToken, env.META_GRAPH_API_VERSION);
  const pages = selection.intent === "INSTAGRAM"
    ? discovered.filter((page) => Boolean(page.instagram_business_account?.id))
    : discovered;
  return { session, env, selection, pages };
}

export async function GET(request: NextRequest) {
  try {
    const { pages } = await selectionContext(request);
    return NextResponse.json({
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        hasInstagram: Boolean(page.instagram_business_account?.id)
      }))
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pageId } = selectionSchema.parse(await request.json());
    const { session, env, selection, pages } = await selectionContext(request);
    const page = pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new Error("Facebook Page yang dipilih tidak lagi tersedia.");
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
        if (selection.intent === "INSTAGRAM") throw error;
      }
    }
    if (!env.META_APP_ID || !env.META_APP_SECRET) throw new Error("Kredensial Meta belum dikonfigurasi.");
    const pageTokenExpiresAt = await getMetaTokenExpiry({
      pageAccessToken: page.access_token,
      appId: env.META_APP_ID,
      appSecret: env.META_APP_SECRET,
      version: env.META_GRAPH_API_VERSION,
      fallback: new Date(selection.tokenExpiresAt)
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
    const response = NextResponse.json({
      success: true,
      connected: connected.instagram ? "Facebook dan Instagram" : "Facebook"
    });
    response.cookies.delete(META_SELECTION_COOKIE);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
