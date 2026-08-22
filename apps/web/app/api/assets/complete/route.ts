import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { brandAssets, createDatabase, withTenant, workspaces } from "@routie/db";
import { inspectObject } from "@routie/storage";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { apiError } from "@/lib/http";

const inputSchema = z.object({
  objectKey: z.string().min(1),
  kind: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "LOGO", "FONT"]),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  checksum: z.string().min(16).max(256),
  metadata: z.record(z.string(), z.string().max(255)).optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approvers cannot upload brand assets");
    const input = inputSchema.parse(await request.json());
    if (!input.objectKey.startsWith(`${session.workspaceId}/uploads/`)) throw new Error("Invalid object key");

    const object = await inspectObject(input.objectKey);
    if (object.sizeBytes !== input.sizeBytes || object.contentType !== input.contentType) throw new Error("Uploaded object metadata does not match the reservation");

    const db = createDatabase();
    const asset = await withTenant(db, session.workspaceId, async (tx) => {
      const [workspace] = await tx.execute<{ storage_used_bytes: number; max_storage_bytes: number }>(
        sql`select storage_used_bytes, max_storage_bytes from ${workspaces} where id = ${session.workspaceId} for update`
      );
      if (!workspace || Number(workspace.storage_used_bytes) + input.sizeBytes > Number(workspace.max_storage_bytes)) throw new Error("Workspace storage quota exceeded");
      const [created] = await tx.insert(brandAssets).values({
        workspaceId: session.workspaceId,
        kind: input.kind,
        objectKey: input.objectKey,
        mimeType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        metadata: { ...object.metadata, ...input.metadata }
      }).returning();
      await tx.update(workspaces).set({
        storageUsedBytes: sql`${workspaces.storageUsedBytes} + ${input.sizeBytes}`,
        updatedAt: new Date()
      }).where(sql`${workspaces.id} = ${session.workspaceId}`);
      return created;
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
