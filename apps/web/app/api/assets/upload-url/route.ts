import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createDatabase, withTenant, workspaces } from "@routie/db";
import { createUploadUrl } from "@routie/storage";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { apiError } from "@/lib/http";

const inputSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(500 * 1024 * 1024)
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approvers cannot upload brand assets");
    const input = inputSchema.parse(await request.json());
    const db = createDatabase();
    const workspace = await withTenant(db, session.workspaceId, (tx) => tx.query.workspaces.findFirst({
      where: eq(workspaces.id, session.workspaceId),
      columns: { storageUsedBytes: true, maxStorageBytes: true }
    }));
    if (!workspace || workspace.storageUsedBytes + input.sizeBytes > workspace.maxStorageBytes) throw new Error("Workspace storage quota exceeded");
    const safeName = input.filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .toLowerCase();
    const objectKey = `${session.workspaceId}/uploads/${randomUUID()}-${safeName}`;
    const uploadUrl = await createUploadUrl(objectKey, input.contentType, input.sizeBytes);
    return NextResponse.json({ objectKey, uploadUrl, expiresInSeconds: 300 });
  } catch (error) {
    return apiError(error);
  }
}
