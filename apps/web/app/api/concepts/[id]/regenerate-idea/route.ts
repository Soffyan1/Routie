import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  brandProfiles,
  calendarSlots,
  contentCalendars,
  contentConcepts,
  createDatabase,
  providerCredentials,
  withTenant
} from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { generationQueue } from "@/lib/queue";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approver tidak dapat membuat ide konten.");

    const { id } = await context.params;
    const db = createDatabase(serverEnv().DATABASE_URL);

    const result = await withTenant(db, session.workspaceId, async (tx) => {
      const [concept] = await tx
        .select()
        .from(contentConcepts)
        .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)))
        .limit(1);

      if (!concept) throw new Error("Konsep konten tidak ditemukan");

      const profile = await tx.query.brandProfiles.findFirst({
        where: (table, { eq }) => eq(table.workspaceId, session.workspaceId)
      });
      if (!profile) throw new Error("Profil brand belum diisi.");

      const [slot] = await tx
        .select()
        .from(calendarSlots)
        .where(eq(calendarSlots.id, concept.slotId))
        .limit(1);

      const [calendar] = slot
        ? await tx.select().from(contentCalendars).where(eq(contentCalendars.id, slot.calendarId)).limit(1)
        : [null];

      const credentials = await tx.select().from(providerCredentials);
      const credential =
        credentials.find((item) => item.capability === "TEXT" && !item.disabledAt) ??
        credentials.find((item) => item.capability === "WEB_SEARCH" && !item.disabledAt);

      if (!credential) {
        throw new Error("Hubungkan Google AI Studio API key di Pengaturan terlebih dahulu.");
      }

      await tx
        .update(contentConcepts)
        .set({
          state: "IDEA_DRAFT",
          topic: "Menyusun ide konten...",
          heldReason: null,
          updatedAt: new Date()
        })
        .where(eq(contentConcepts.id, id));

      return {
        concept,
        calendarId: calendar?.id || "manual-calendar",
        credential,
        profile
      };
    });

    const promptContext = [
      `Brand: ${result.profile.businessName}`,
      `Brief: ${result.profile.brief}`,
      `Audience: ${result.profile.targetAudience}`,
      `Tone: ${result.profile.tone}`,
      `Pillar: ${result.profile.contentPillars.map((p) => `${p.name} ${p.percentage}%`).join(", ")}`,
      `Larangan klaim: ${result.profile.prohibitedClaims.join("; ") || "tidak ada"}`
    ].join("\n");

    const queue = generationQueue();
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
            "Buat tepat 1 ide konten yang sangat menarik, edukatif, dan bernilai tinggi untuk media sosial.",
            promptContext,
            "Kembalikan JSON array saja berisi tepat 1 item dengan property topic, hook, outline, initialCaption, hashtags (array 3-7 hashtag string), contentPillar, dan recommendedKind (TEXT|IMAGE|CAROUSEL|SHORT_VIDEO|STORY). Jangan gunakan markdown fence."
          ].join("\n"),
          idempotencyKey: `regen-idea:${id}:${Date.now()}`
        },
        target: {
          kind: "CALENDAR_IDEAS",
          calendarId: result.calendarId,
          conceptIds: [id]
        }
      },
      {
        jobId: `regen-idea-${id}-${Date.now()}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 3_000 }
      }
    );

    return NextResponse.json({ ok: true, message: "Ide konten sedang dibuat ulang oleh AI." });
  } catch (error) {
    return apiError(error);
  }
}
