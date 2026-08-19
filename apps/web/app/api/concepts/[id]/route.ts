import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, contentConcepts, createDatabase, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const updateConceptSchema = z.object({
  topic: z.string().trim().min(1).max(300).optional(),
  hook: z.string().trim().max(500).optional(),
  outline: z.string().trim().max(5_000).optional(),
  initialCaption: z.string().trim().max(10_000).optional(),
  hashtags: z.array(z.string()).optional(),
  contentPillar: z.string().trim().max(200).optional(),
  recommendedKind: z.enum(["TEXT", "IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"]).optional(),
  expectedVersion: z.number().int().positive().optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approver tidak dapat mengedit konsep konten");
    const { id } = await context.params;
    const input = updateConceptSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);
    const result = await withTenant(db, session.workspaceId, async (tx) => {
      const [concept] = await tx.select().from(contentConcepts).where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId))).limit(1);
      if (!concept) throw new Error("Konsep konten tidak ditemukan");
      if (input.expectedVersion !== undefined && concept.version !== input.expectedVersion) {
        throw new Error("Konten telah diperbarui oleh pengguna lain; segarkan halaman sebelum mengedit");
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        version: concept.version + 1
      };

      if (input.topic !== undefined) updateData.topic = input.topic;
      if (input.hook !== undefined) updateData.hook = input.hook;
      if (input.outline !== undefined) updateData.outline = input.outline;
      if (input.initialCaption !== undefined) updateData.initialCaption = input.initialCaption;
      if (input.hashtags !== undefined) updateData.hashtags = input.hashtags;
      if (input.contentPillar !== undefined) updateData.contentPillar = input.contentPillar;
      if (input.recommendedKind !== undefined) updateData.recommendedKind = input.recommendedKind;

      const [updated] = await tx
        .update(contentConcepts)
        .set(updateData)
        .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)))
        .returning();

      await tx.insert(auditEvents).values({
        workspaceId: session.workspaceId,
        actorId: session.sub,
        action: "CONTENT_IDEA_EDITED",
        entityType: "content_concept",
        entityId: id,
        before: { version: concept.version, state: concept.state },
        after: { version: updated!.version, state: updated!.state }
      });
      return updated!;
    });
    return NextResponse.json({ concept: result });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approver tidak dapat menghapus konten");
    const { id } = await context.params;
    const db = createDatabase(serverEnv().DATABASE_URL);

    await withTenant(db, session.workspaceId, async (tx) => {
      const [concept] = await tx
        .select()
        .from(contentConcepts)
        .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)))
        .limit(1);

      if (!concept) throw new Error("Konsep konten tidak ditemukan");

      // Delete slot and cascade
      await tx.delete(contentConcepts).where(eq(contentConcepts.id, id));

      await tx.insert(auditEvents).values({
        workspaceId: session.workspaceId,
        actorId: session.sub,
        action: "CONTENT_DELETED",
        entityType: "content_concept",
        entityId: id,
        before: { topic: concept.topic, state: concept.state }
      });
    });

    return NextResponse.json({ success: true, message: "Konten berhasil dihapus" });
  } catch (error) {
    return apiError(error);
  }
}
