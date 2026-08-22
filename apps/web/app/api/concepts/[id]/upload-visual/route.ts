import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, brandAssets, calendarSlots, channelVariants, contentCalendars, contentConcepts, createDatabase, mediaAssets, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const inputSchema = z.object({ assetId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role ini tidak dapat mengunggah visual.");
    const { assetId } = inputSchema.parse(await request.json());
    const { id: conceptId } = await params;
    const db = createDatabase(serverEnv().DATABASE_URL);
    await withTenant(db, session.workspaceId, async (tx) => {
      const [asset] = await tx.select().from(brandAssets).where(and(eq(brandAssets.id, assetId), eq(brandAssets.workspaceId, session.workspaceId))).limit(1);
      if (!asset || !asset.mimeType.startsWith("image/")) throw new Error("Hasil AI harus berupa gambar PNG, JPG, atau WebP.");
      const [context] = await tx.select({ concept: contentConcepts, channels: contentCalendars.channels })
        .from(contentConcepts).innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId)).innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
        .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, session.workspaceId))).limit(1);
      if (!context) throw new Error("Konten Calendar tidak ditemukan.");
      for (const channel of context.channels) {
        const [variant] = await tx.insert(channelVariants).values({ workspaceId: session.workspaceId, conceptId, channel, deliveryMode: "AUTO_PUBLISH", contentKind: "IMAGE", caption: context.concept.initialCaption, metadata: { mode: context.concept.generationMode } })
          .onConflictDoUpdate({ target: [channelVariants.conceptId, channelVariants.channel], set: { caption: context.concept.initialCaption, contentKind: "IMAGE", updatedAt: new Date() } }).returning();
        if (!variant) throw new Error("Gagal menyiapkan versi channel.");
        await tx.update(mediaAssets).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(mediaAssets.variantId, variant.id), isNull(mediaAssets.archivedAt)));
        await tx.insert(mediaAssets).values({ workspaceId: session.workspaceId, variantId: variant.id, kind: "IMAGE", source: "ASSISTED_UPLOAD", objectKey: asset.objectKey, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksum: asset.checksum, generationMetadata: { mode: context.concept.generationMode, uploadedBy: session.sub } });
      }
      await tx.update(contentConcepts).set({ state: "FINAL_REVIEW", heldReason: null, updatedAt: new Date() }).where(eq(contentConcepts.id, conceptId));
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "CONTENT_VISUAL_UPLOADED", entityType: "content_concept", entityId: conceptId, after: { assetId } });
    });
    return NextResponse.json({ success: true, conceptId });
  } catch (error) { return apiError(error); }
}
