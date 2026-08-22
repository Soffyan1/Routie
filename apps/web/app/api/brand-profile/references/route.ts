import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { auditEvents, brandAssets, createDatabase, withTenant, workspaces } from "@routie/db";
import { createDownloadUrl, deleteObject } from "@routie/storage";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const USAGE = "BRAND_STYLE_REFERENCE";
const isReference = (metadata: Record<string, unknown>) => metadata.usage === USAGE;

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const assets = await withTenant(db, session.workspaceId, async (tx) => tx
      .select().from(brandAssets)
      .where(eq(brandAssets.workspaceId, session.workspaceId))
      .orderBy(asc(brandAssets.createdAt)));
    const references = await Promise.all(assets.filter((asset) => isReference(asset.metadata)).map(async (asset) => ({
      id: asset.id,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      filename: typeof asset.metadata.filename === "string" ? asset.metadata.filename : "referensi-brand",
      isPrimary: asset.metadata.isPrimary === true,
      url: await createDownloadUrl(asset.objectKey, 300, { disposition: "inline" })
    })));
    return NextResponse.json({ references });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role cannot edit brand references");
    const { assetId, filename } = await request.json() as { assetId?: string; filename?: string };
    if (!assetId) throw new Error("Asset referensi tidak valid");
    const db = createDatabase(serverEnv().DATABASE_URL);
    const reference = await withTenant(db, session.workspaceId, async (tx) => {
      const assets = await tx.select().from(brandAssets).where(eq(brandAssets.workspaceId, session.workspaceId));
      const current = assets.filter((asset) => isReference(asset.metadata));
      const asset = assets.find((item) => item.id === assetId);
      if (!asset || asset.kind !== "IMAGE" || !asset.mimeType.startsWith("image/")) throw new Error("Hanya gambar yang dapat menjadi referensi brand");
      if (!isReference(asset.metadata) && current.length >= 3) throw new Error("Maksimal tiga gambar referensi brand");
      const metadata = { ...asset.metadata, usage: USAGE, filename: filename?.slice(0, 255) || asset.metadata.filename || "referensi-brand", isPrimary: current.length === 0 || asset.metadata.isPrimary === true };
      const [saved] = await tx.update(brandAssets).set({ metadata, updatedAt: new Date() }).where(eq(brandAssets.id, asset.id)).returning();
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "BRAND_REFERENCE_ADDED", entityType: "brand_asset", entityId: asset.id, after: { usage: USAGE } });
      return saved!;
    });
    return NextResponse.json({ reference: { id: reference.id } }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Role cannot delete brand references");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Referensi tidak valid");
    const db = createDatabase(serverEnv().DATABASE_URL);
    const removed = await withTenant(db, session.workspaceId, async (tx) => {
      const [asset] = await tx.select().from(brandAssets).where(and(eq(brandAssets.id, id), eq(brandAssets.workspaceId, session.workspaceId))).limit(1);
      if (!asset || !isReference(asset.metadata)) throw new Error("Referensi tidak ditemukan");
      await tx.delete(brandAssets).where(eq(brandAssets.id, asset.id));
      await tx.update(workspaces).set({ storageUsedBytes: sql`greatest(0, ${workspaces.storageUsedBytes} - ${asset.sizeBytes})`, updatedAt: new Date() }).where(eq(workspaces.id, session.workspaceId));
      await tx.insert(auditEvents).values({ workspaceId: session.workspaceId, actorId: session.sub, action: "BRAND_REFERENCE_REMOVED", entityType: "brand_asset", entityId: asset.id });
      return asset;
    });
    await deleteObject(removed.objectKey);
    return NextResponse.json({ removed: true });
  } catch (error) { return apiError(error); }
}
