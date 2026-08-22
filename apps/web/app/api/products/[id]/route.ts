import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auditEvents, createDatabase, products, withTenant } from "@routie/db";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(140).optional(), description: z.string().trim().max(2_000).optional(),
  benefits: z.array(z.string().trim().min(1).max(180)).max(8).optional(), priceText: z.string().trim().max(180).optional(),
  callToAction: z.string().trim().max(180).optional(), destinationUrl: z.string().trim().url().or(z.literal("")).optional()
});
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(); await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role ini tidak dapat mengubah produk.");
    const input = schema.parse(await request.json()); const { id } = await params; const db = createDatabase(serverEnv().DATABASE_URL);
    const product = await withTenant(db, session.workspaceId, async (tx) => {
      const [updated] = await tx.update(products).set({ ...input, updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.workspaceId, session.workspaceId))).returning();
      if (!updated) throw new Error("Produk tidak ditemukan.");
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "PRODUCT_UPDATED", entityType: "product", entityId: id }); return updated;
    }); return NextResponse.json({ product });
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(); await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role ini tidak dapat menghapus produk.");
    const { id } = await params; const db = createDatabase(serverEnv().DATABASE_URL);
    await withTenant(db, session.workspaceId, async (tx) => {
      const [updated] = await tx.update(products).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.workspaceId, session.workspaceId))).returning();
      if (!updated) throw new Error("Produk tidak ditemukan.");
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "PRODUCT_ARCHIVED", entityType: "product", entityId: id });
    }); return NextResponse.json({ archived: true });
  } catch (error) { return apiError(error); }
}
