import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { auditEvents, brandAssets, createDatabase, productAssets, products, withTenant } from "@routie/db";
import { createDownloadUrl } from "@routie/storage";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const productSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2_000).optional().default(""),
  benefits: z.array(z.string().trim().min(1).max(180)).max(8).optional().default([]),
  priceText: z.string().trim().max(180).optional().default(""),
  callToAction: z.string().trim().max(180).optional().default(""),
  destinationUrl: z.string().trim().url().or(z.literal("")).optional().default("")
});

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const rows = await withTenant(db, session.workspaceId, (tx) => tx
      .select({ product: products, asset: brandAssets, relation: productAssets })
      .from(products)
      .leftJoin(productAssets, eq(productAssets.productId, products.id))
      .leftJoin(brandAssets, eq(brandAssets.id, productAssets.brandAssetId))
      .where(and(eq(products.workspaceId, session.workspaceId), isNull(products.archivedAt)))
      .orderBy(asc(products.createdAt), asc(productAssets.sortOrder)));
    const mapped = new Map<string, { id: string; name: string; description: string; benefits: string[]; priceText: string; callToAction: string; destinationUrl: string; assets: Array<{ id: string; url: string; role: string; mimeType: string }> }>();
    for (const row of rows) {
      const product = row.product;
      const entry = mapped.get(product.id) ?? {
        id: product.id, name: product.name, description: product.description, benefits: product.benefits,
        priceText: product.priceText, callToAction: product.callToAction, destinationUrl: product.destinationUrl, assets: []
      };
      if (row.asset && row.relation) entry.assets.push({
        id: row.asset.id,
        url: await createDownloadUrl(row.asset.objectKey, 300, { disposition: "inline" }),
        role: row.relation.role,
        mimeType: row.asset.mimeType
      });
      mapped.set(product.id, entry);
    }
    return NextResponse.json({ products: [...mapped.values()] });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role ini tidak dapat menambah produk.");
    const input = productSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);
    const product = await withTenant(db, session.workspaceId, async (tx) => {
      const [created] = await tx.insert(products).values({ workspaceId: session.workspaceId, ...input }).returning();
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "PRODUCT_CREATED", entityType: "product", entityId: created!.id, after: { name: input.name } });
      return created!;
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) { return apiError(error); }
}
