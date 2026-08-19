import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  auditEvents,
  brandProfiles,
  calendarSlots,
  channelVariants,
  contentCalendars,
  contentConcepts,
  createDatabase,
  mediaAssets,
  providerCredentials,
  withTenant
} from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { buildImagePrompt } from "@/lib/media-generation";
import { generationQueue } from "@/lib/queue";

const slotCreateSchema = z.object({
  mode: z.enum(["FULL_AI", "SEMI_AI", "MANUAL"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  localTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().default("Asia/Jakarta"),
  channels: z.array(z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "THREADS", "YOUTUBE", "X"])).min(1),
  useWebSearch: z.boolean().optional(),
  // For SEMI_AI & MANUAL
  topic: z.string().optional(),
  hook: z.string().optional(),
  initialCaption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  contentPillar: z.string().optional(),
  recommendedKind: z.enum(["TEXT", "IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"]).optional(),
  // For MANUAL
  objectKey: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approver tidak dapat membuat slot konten baru.");

    const input = slotCreateSchema.parse(await request.json());
    const [year, month] = input.localDate.split("-").map(Number) as [number, number];

    const scheduledFor = DateTime.fromISO(`${input.localDate}T${input.localTime}`, { zone: input.timezone });
    if (!scheduledFor.isValid) {
      throw new Error(`Format jadwal tidak valid: ${scheduledFor.invalidExplanation ?? "unknown"}`);
    }

    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);

    const result = await withTenant(db, session.workspaceId, async (tx) => {
      // 1. Get brand profile
      const profile = await tx.query.brandProfiles.findFirst({
        where: (table, { eq }) => eq(table.workspaceId, session.workspaceId)
      });
      if (!profile) throw new Error("Selesaikan profil brand sebelum membuat konten.");

      // 2. Find or create contentCalendars for this month
      let calendar = await tx.query.contentCalendars.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.workspaceId, session.workspaceId),
            eq(table.year, year),
            eq(table.month, month)
          )
      });

      if (!calendar) {
        const [createdCal] = await tx
          .insert(contentCalendars)
          .values({
            workspaceId: session.workspaceId,
            year,
            month,
            conceptsPerDay: 1,
            timezone: input.timezone,
            postingTimes: [input.localTime],
            channels: input.channels,
            createdBy: session.sub
          })
          .returning();
        calendar = createdCal!;
      }

      // 3. Get next sequence for slot
      const lastSlot = await tx
        .select({ sequence: calendarSlots.sequence })
        .from(calendarSlots)
        .where(eq(calendarSlots.calendarId, calendar.id))
        .orderBy(desc(calendarSlots.sequence))
        .limit(1);

      const nextSequence = (lastSlot[0]?.sequence ?? 0) + 1;

      // 4. Insert calendarSlot
      const [slot] = await tx
        .insert(calendarSlots)
        .values({
          workspaceId: session.workspaceId,
          calendarId: calendar.id,
          sequence: nextSequence,
          localDate: input.localDate,
          localTime: input.localTime,
          timezone: input.timezone,
          scheduledFor: scheduledFor.toUTC().toJSDate()
        })
        .returning();

      // 5. Handle by creationMode
      if (input.mode === "FULL_AI") {
        // Need Text or Web Search credential
        const credentials = await tx.select().from(providerCredentials);
        const credential = input.useWebSearch
          ? credentials.find((item) => item.capability === "WEB_SEARCH" && !item.disabledAt)
          : credentials.find((item) => item.capability === "TEXT" && !item.disabledAt) ??
            credentials.find((item) => item.capability === "WEB_SEARCH" && !item.disabledAt);

        if (!credential) {
          throw new Error("Hubungkan Google AI Studio API key di Pengaturan sebelum membuat ide konten AI.");
        }

        const [concept] = await tx
          .insert(contentConcepts)
          .values({
            workspaceId: session.workspaceId,
            slotId: slot!.id,
            state: "IDEA_DRAFT",
            creationMode: "AI",
            topic: "Menyusun ide konten...",
            recommendedKind: input.recommendedKind || "IMAGE"
          })
          .returning();

        return {
          mode: "FULL_AI" as const,
          concept: concept!,
          slot: slot!,
          calendar: calendar!,
          credential,
          profile
        };
      }

      if (input.mode === "SEMI_AI") {
        const [concept] = await tx
          .insert(contentConcepts)
          .values({
            workspaceId: session.workspaceId,
            slotId: slot!.id,
            state: "IDEA_APPROVED",
            creationMode: "SEMI_AI",
            topic: input.topic || "Ide Konten Baru",
            hook: input.hook || "",
            initialCaption: input.initialCaption || "",
            hashtags: input.hashtags || [],
            contentPillar: input.contentPillar || "Umum",
            recommendedKind: input.recommendedKind || "IMAGE"
          })
          .returning();

        // Check image credential for auto generating image
        const [imgCred] = await tx
          .select()
          .from(providerCredentials)
          .where(
            and(
              eq(providerCredentials.workspaceId, session.workspaceId),
              eq(providerCredentials.capability, "IMAGE"),
              isNull(providerCredentials.disabledAt)
            )
          )
          .limit(1);

        return {
          mode: "SEMI_AI" as const,
          concept: concept!,
          slot: slot!,
          calendar: calendar!,
          imgCred: imgCred ?? null,
          profile
        };
      }

      // Mode MANUAL
      const [concept] = await tx
        .insert(contentConcepts)
        .values({
          workspaceId: session.workspaceId,
          slotId: slot!.id,
          state: "FINAL_REVIEW",
          creationMode: "MANUAL",
          topic: input.topic || "Konten Siap Terbit",
          hook: input.hook || "",
          initialCaption: input.initialCaption || "",
          hashtags: input.hashtags || [],
          contentPillar: input.contentPillar || "Umum",
          recommendedKind: input.recommendedKind || "IMAGE"
        })
        .returning();

      // Create channel variants for each channel
      for (const ch of input.channels) {
        const [variant] = await tx
          .insert(channelVariants)
          .values({
            workspaceId: session.workspaceId,
            conceptId: concept!.id,
            channel: ch,
            deliveryMode: "AUTO_PUBLISH",
            contentKind: input.recommendedKind || "IMAGE",
            caption: input.initialCaption || ""
          })
          .returning();

        // If user uploaded an image objectKey, link to variant
        if (input.objectKey && variant) {
          await tx.insert(mediaAssets).values({
            workspaceId: session.workspaceId,
            variantId: variant.id,
            kind: "IMAGE",
            source: "MANUAL_UPLOAD",
            objectKey: input.objectKey,
            mimeType: input.mimeType || "image/jpeg",
            sizeBytes: input.sizeBytes || 0,
            checksum: `manual-${Date.now()}`
          });
        }
      }

      return {
        mode: "MANUAL" as const,
        concept: concept!,
        slot: slot!,
        calendar: calendar!
      };
    });

    // Handle background jobs based on mode
    const queue = generationQueue();

    if (result.mode === "FULL_AI" && result.credential) {
      const promptContext = [
        `Brand: ${result.profile.businessName}`,
        `Brief: ${result.profile.brief}`,
        `Audience: ${result.profile.targetAudience}`,
        `Tone: ${result.profile.tone}`,
        `Pillar: ${result.profile.contentPillars.map((p) => `${p.name} ${p.percentage}%`).join(", ")}`,
        `Larangan klaim: ${result.profile.prohibitedClaims.join("; ") || "tidak ada"}`
      ].join("\n");

      await queue.add(
        "calendar-ideas",
        {
          workspaceId: session.workspaceId,
          credentialId: result.credential.id,
          request: {
            capability: result.credential.capability,
            model: result.credential.model,
            system: "Anda adalah content strategist profesional.",
            prompt: [
              "Buat tepat 1 ide konten yang sangat menarik, relevan, dan berbobot untuk media sosial.",
              promptContext,
              "Kembalikan JSON array saja berisi tepat 1 item dengan property topic, hook, outline, initialCaption, hashtags (array 3-7 hashtag string), contentPillar, dan recommendedKind (TEXT|IMAGE|CAROUSEL|SHORT_VIDEO|STORY). Jangan gunakan markdown fence."
            ].join("\n"),
            idempotencyKey: `single-idea:${result.concept.id}:v1`
          },
          target: {
            kind: "CALENDAR_IDEAS",
            calendarId: result.calendar.id,
            conceptIds: [result.concept.id]
          }
        },
        {
          jobId: `single-idea-${result.concept.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 }
        }
      );
    } else if (result.mode === "SEMI_AI" && result.imgCred) {
      const prompt = buildImagePrompt({
        businessName: result.profile.businessName,
        brief: result.profile.brief,
        targetAudience: result.profile.targetAudience,
        tone: result.profile.tone,
        colors: result.profile.colors,
        prohibitedClaims: result.profile.prohibitedClaims,
        topic: result.concept.topic,
        hook: result.concept.hook,
        outline: result.concept.outline,
        contentPillar: result.concept.contentPillar
      });

      await queue.add(
        "generate-concept-media",
        {
          workspaceId: session.workspaceId,
          credentialId: result.imgCred.id,
          request: {
            capability: "IMAGE",
            model: result.imgCred.model,
            prompt,
            aspectRatio: "1:1",
            idempotencyKey: `concept-media:${result.concept.id}:v1`
          },
          target: {
            kind: "CONCEPT_MEDIA",
            conceptId: result.concept.id
          }
        },
        {
          jobId: `media-${result.concept.id}-v1`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 }
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          input.mode === "FULL_AI"
            ? "Ide konten AI sedang diproses di background."
            : input.mode === "SEMI_AI"
            ? "Draft dibuat & generasi gambar AI sedang diproses."
            : "Konten manual berhasil dijadwalkan dan siap direview.",
        conceptId: result.concept.id
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error);
  }
}
