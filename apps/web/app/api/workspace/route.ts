import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, withTenant, workspaces } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const workspace = await withTenant(db, session.workspaceId, async (tx) => {
      const [record] = await tx.select().from(workspaces).where(eq(workspaces.id, session.workspaceId)).limit(1);
      return record ?? null;
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    return apiError(error);
  }
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  timezone: z.string().min(2).max(100),
  language: z.string().min(2).max(20),
  maxConceptsPerDay: z.number().int().min(1).max(10).default(3),
  publicationMode: z.enum(["SAFE", "AUTOMATIC"]).default("SAFE")
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER") {
      throw new Error("Only the workspace owner can edit workspace preferences");
    }

    const input = updateWorkspaceSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);

    const updated = await withTenant(db, session.workspaceId, async (tx) => {
      const [saved] = await tx
        .update(workspaces)
        .set({
          name: input.name,
          timezone: input.timezone,
          language: input.language,
          maxConceptsPerDay: input.maxConceptsPerDay,
          publicationMode: input.publicationMode,
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, session.workspaceId))
        .returning();
      return saved;
    });

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    return apiError(error);
  }
}
