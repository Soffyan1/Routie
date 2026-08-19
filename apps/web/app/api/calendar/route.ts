import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  calendarSlots,
  channelVariants,
  contentCalendars,
  contentConcepts,
  createDatabase,
  mediaAssets,
  users,
  withTenant,
  workspaces
} from "@routie/db";
import { createDownloadUrl } from "@routie/storage";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export interface CalendarConceptItem {
  id: string;
  topic: string;
  hook: string;
  outline: string;
  initialCaption: string;
  hashtags: string[];
  contentPillar: string;
  recommendedKind: string;
  state: string;
  creationMode: string;
  heldReason: string | null;
  version: number;
  localDate: string;
  localTime: string;
  timezone: string;
  scheduledFor: string | null;
  channels: string[];
  calendarId: string;
  slotId: string;
  mediaAsset: {
    id: string;
    kind: string;
    objectKey: string;
    mimeType: string;
    url: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  createdBy: {
    name: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : currentYear;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : currentMonth;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new Error("Parameter year dan month tidak valid.");
    }

    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);

    const data = await withTenant(db, session.workspaceId, async (tx) => {
      // 1. Fetch concepts with slot and calendar for this month
      const rows = await tx
        .select({
          concept: contentConcepts,
          slot: calendarSlots,
          calendar: contentCalendars,
          creator: {
            name: users.name
          }
        })
        .from(contentConcepts)
        .innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId))
        .innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
        .leftJoin(users, eq(users.id, contentCalendars.createdBy))
        .where(
          and(
            eq(contentConcepts.workspaceId, session.workspaceId),
            eq(contentCalendars.year, year),
            eq(contentCalendars.month, month)
          )
        )
        .orderBy(asc(calendarSlots.scheduledFor), asc(calendarSlots.sequence));

      if (rows.length === 0) {
        return [];
      }

      const conceptIds = rows.map((r) => r.concept.id);

      // 2. Fetch variants and associated media assets
      const variants = await tx
        .select({
          variant: channelVariants,
          media: mediaAssets
        })
        .from(channelVariants)
        .leftJoin(mediaAssets, eq(mediaAssets.variantId, channelVariants.id))
        .where(
          and(
            eq(channelVariants.workspaceId, session.workspaceId),
            inArray(channelVariants.conceptId, conceptIds)
          )
        );

      // Map media per concept
      const mediaMap = new Map<string, { id: string; kind: string; objectKey: string; mimeType: string; width: number | null; height: number | null }>();
      for (const v of variants) {
        if (v.media && !mediaMap.has(v.variant.conceptId)) {
          mediaMap.set(v.variant.conceptId, {
            id: v.media.id,
            kind: v.media.kind,
            objectKey: v.media.objectKey,
            mimeType: v.media.mimeType,
            width: v.media.width,
            height: v.media.height
          });
        }
      }

      // Generate signed URLs if storage is configured
      const formatted: CalendarConceptItem[] = [];
      for (const row of rows) {
        const rawMedia = mediaMap.get(row.concept.id);
        let mediaUrl: string | null = null;
        if (rawMedia?.objectKey) {
          try {
            mediaUrl = await createDownloadUrl(rawMedia.objectKey, 3600);
          } catch {
            mediaUrl = null;
          }
        }

        formatted.push({
          id: row.concept.id,
          topic: row.concept.topic,
          hook: row.concept.hook,
          outline: row.concept.outline,
          initialCaption: row.concept.initialCaption,
          hashtags: row.concept.hashtags || [],
          contentPillar: row.concept.contentPillar || "Umum",
          recommendedKind: row.concept.recommendedKind || "IMAGE",
          state: row.concept.state,
          creationMode: row.concept.creationMode || "AI",
          heldReason: row.concept.heldReason,
          version: row.concept.version,
          localDate: row.slot.localDate,
          localTime: row.slot.localTime,
          timezone: row.slot.timezone,
          scheduledFor: row.slot.scheduledFor ? row.slot.scheduledFor.toISOString() : null,
          channels: (row.calendar.channels as string[]) || [],
          calendarId: row.calendar.id,
          slotId: row.slot.id,
          mediaAsset: rawMedia
            ? {
                id: rawMedia.id,
                kind: rawMedia.kind,
                objectKey: rawMedia.objectKey,
                mimeType: rawMedia.mimeType,
                url: mediaUrl,
                width: rawMedia.width,
                height: rawMedia.height
              }
            : null,
          createdBy: {
            name: row.creator?.name ?? null
          },
          createdAt: row.concept.createdAt.toISOString(),
          updatedAt: row.concept.updatedAt.toISOString()
        });
      }

      return formatted;
    });

    // Group concepts by date (YYYY-MM-DD)
    const days: Record<string, CalendarConceptItem[]> = {};
    for (const item of data) {
      if (!days[item.localDate]) {
        days[item.localDate] = [];
      }
      days[item.localDate]!.push(item);
    }

    const summary = {
      total: data.length,
      ready: data.filter((c) => ["APPROVED", "SCHEDULED"].includes(c.state)).length,
      draft: data.filter((c) => c.state === "IDEA_DRAFT").length,
      ideaReview: data.filter((c) => c.state === "IDEA_REVIEW").length,
      finalReview: data.filter((c) => c.state === "FINAL_REVIEW").length,
      review: data.filter((c) => ["IDEA_REVIEW", "FINAL_REVIEW"].includes(c.state)).length,
      generating: data.filter((c) => ["IDEA_APPROVED", "GENERATING"].includes(c.state)).length,
      published: data.filter((c) => c.state === "PUBLISHED").length,
      rejected: data.filter((c) => ["REJECTED", "HELD", "FAILED"].includes(c.state)).length
    };

    return NextResponse.json({
      year,
      month,
      summary,
      days,
      concepts: data
    });
  } catch (error) {
    return apiError(error);
  }
}
