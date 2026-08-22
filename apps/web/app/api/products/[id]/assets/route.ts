import { NextRequest, NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { brandAssets, createDatabase, productAssets, products, withTenant } from "@routie/db";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const schema = z.object({ assetId: z.string().uuid(), role: z.enum(["PRODUCT_PRIMARY", "PRODUCT_ALTERNATIVE", "PRODUCT_LOGO"]).default("PRODUCT_ALTERNATIVE") });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(); await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role ini tidak dapat mengubah gambar produk.");
    const input = schema.parse(await request.json()); const { id } = await params; const db = createDatabase(serverEnv().DATABASE_URL);
    const relation = await withTenant(db, session.workspaceId, async (tx) => {
      const [[product], [asset], [usage]] = await Promise.all([
        tx.select().from(products).where(and(eq(products.id, id), eq(products.workspaceId, session.workspaceId))).limit(1),
        tx.select().from(brandAssets).where(and(eq(brandAssets.id, input.assetId), eq(brandAssets.workspaceId, session.workspaceId))).limit(1),
        tx.select({ value: count() }).from(productAssets).where(eq(productAssets.productId, id))
      ]);
      if (!product) throw new Error("Produk tidak ditemukan.");
      if (!asset || asset.kind !== "IMAGE" || !asset.mimeType.startsWith("image/")) throw new Error("Pilih file gambar yang valid.");
      if ((usage?.value ?? 0) >= 3) throw new Error("Maksimal tiga gambar produk.");
      const [created] = await tx.insert(productAssets).values({ workspaceId: session.workspaceId, productId: id, brandAssetId: input.assetId, role: input.role, sortOrder: usage?.value ?? 0 }).onConflictDoNothing().returning();
      return created ?? null;
    }); return NextResponse.json({ relation }, { status: 201 });
  } catch (error) { return apiError(error); }
}
