import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, brandAssets, calendarSlots, channelVariants, contentCalendars, contentConcepts, creativeBriefs, createDatabase, mediaAssets, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const schema = z.object({ assetId: z.string().uuid() });

/** Attaches a user-generated Mode Hemat result to the original Calendar concept. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role ini tidak dapat mengunggah hasil visual.");
    const { assetId } = schema.parse(await request.json());
    const { id } = await params;
    const db = createDatabase(serverEnv().DATABASE_URL);
    const conceptId = await withTenant(db, session.workspaceId, async (tx) => {
      const [brief] = await tx.select().from(creativeBriefs).where(and(eq(creativeBriefs.id, id), eq(creativeBriefs.workspaceId, session.workspaceId))).limit(1);
      if (!brief || brief.mode !== "ASSISTED") throw new Error("Paket Mode Hemat tidak ditemukan.");
      const [asset] = await tx.select().from(brandAssets).where(and(eq(brandAssets.id, assetId), eq(brandAssets.workspaceId, session.workspaceId))).limit(1);
      if (!asset || asset.kind !== "IMAGE" || !asset.mimeType.startsWith("image/")) throw new Error("Unggah hasil berupa gambar PNG, JPG, atau WebP.");
      const [context] = await tx.select({ concept: contentConcepts, channels: contentCalendars.channels })
        .from(contentConcepts).innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId)).innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
        .where(and(eq(contentConcepts.id, brief.conceptId), eq(contentConcepts.workspaceId, session.workspaceId))).limit(1);
      if (!context) throw new Error("Draft kalender tidak ditemukan.");
      for (const channel of context.channels) {
        const [variant] = await tx.insert(channelVariants).values({ workspaceId: session.workspaceId, conceptId: context.concept.id, channel, deliveryMode: "AUTO_PUBLISH", contentKind: "IMAGE", caption: context.concept.initialCaption, metadata: { creativeBriefId: brief.id, mode: "ASSISTED" } })
          .onConflictDoUpdate({ target: [channelVariants.conceptId, channelVariants.channel], set: { caption: context.concept.initialCaption, updatedAt: new Date() } }).returning();
        if (!variant) throw new Error("Gagal menyiapkan versi channel.");
        await tx.insert(mediaAssets).values({ workspaceId: session.workspaceId, variantId: variant.id, kind: "IMAGE", source: "ASSISTED_UPLOAD", objectKey: asset.objectKey, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksum: asset.checksum, generationMetadata: { creativeBriefId: brief.id, mode: "ASSISTED" } });
      }
      await tx.update(creativeBriefs).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(creativeBriefs.id, brief.id));
      await tx.update(contentConcepts).set({ state: "FINAL_REVIEW", heldReason: null, updatedAt: new Date() }).where(eq(contentConcepts.id, context.concept.id));
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "ASSISTED_POSTER_RESULT_UPLOADED", entityType: "creative_brief", entityId: brief.id, after: { assetId, conceptId: context.concept.id } });
      return context.concept.id;
    });
    return NextResponse.json({ success: true, conceptId });
  } catch (error) { return apiError(error); }
}
