import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createDatabase, mediaAssets, withTenant } from "@routie/db";
import { createDownloadUrl } from "@routie/storage";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm"
};

function buildDownloadFilename(asset: { id: string; kind: string; mimeType: string }) {
  const extension = MIME_EXTENSIONS[asset.mimeType.toLowerCase()] ?? (asset.kind === "VIDEO" ? "mp4" : "jpg");
  const mediaType = asset.kind === "VIDEO" || asset.mimeType.toLowerCase().startsWith("video/") ? "video" : "gambar";
  return `routie-${mediaType}-${asset.id.slice(0, 8)}.${extension}`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    const { id } = await context.params;
    const db = createDatabase(serverEnv().DATABASE_URL);

    const asset = await withTenant(db, session.workspaceId, async (tx) => {
      const [found] = await tx
        .select({
          id: mediaAssets.id,
          kind: mediaAssets.kind,
          mimeType: mediaAssets.mimeType,
          objectKey: mediaAssets.objectKey,
          archivedAt: mediaAssets.archivedAt
        })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, id), eq(mediaAssets.workspaceId, session.workspaceId)))
        .limit(1);
      return found;
    });

    if (!asset || asset.archivedAt) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Media tidak tersedia atau sudah dibersihkan." },
        { status: 404 }
      );
    }

    const filename = buildDownloadFilename(asset);
    const downloadUrl = await createDownloadUrl(asset.objectKey, 120, {
      disposition: "attachment",
      filename
    });

    return NextResponse.json(
      { downloadUrl, filename, expiresInSeconds: 120 },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    return apiError(error);
  }
}
