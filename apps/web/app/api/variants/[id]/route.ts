import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, channelVariants, contentConcepts, createDatabase, withTenant } from "@routie/db";
import { stateAfterVariantEdit } from "@routie/domain";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const updateSchema = z.object({ caption: z.string().max(10_000).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).refine((value) => value.caption !== undefined || value.metadata !== undefined);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approvers cannot edit channel variants");
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);
    const result = await withTenant(db, session.workspaceId, async (tx) => {
      const [row] = await tx
        .select({ variant: channelVariants, concept: contentConcepts })
        .from(channelVariants)
        .innerJoin(contentConcepts, eq(contentConcepts.id, channelVariants.conceptId))
        .where(and(eq(channelVariants.id, id), eq(channelVariants.workspaceId, session.workspaceId)))
        .limit(1);
      if (!row) throw new Error("Channel variant not found");
      const nextState = stateAfterVariantEdit(row.concept.state);
      const [variant] = await tx
        .update(channelVariants)
        .set({ ...input, version: row.variant.version + 1, approvedAt: null, approvedBy: null, rejectedAt: null, rejectionReason: null, updatedAt: new Date() })
        .where(eq(channelVariants.id, id))
        .returning();
      if (nextState !== row.concept.state) {
        await tx.update(contentConcepts).set({ state: nextState, version: row.concept.version + 1, updatedAt: new Date() }).where(eq(contentConcepts.id, row.concept.id));
      }
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "CHANNEL_VARIANT_EDITED", entityType: "channel_variant", entityId: id, before: { version: row.variant.version }, after: { version: variant!.version, approvalRevoked: true } });
      return { variant, conceptState: nextState };
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
