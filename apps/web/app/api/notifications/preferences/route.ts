import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, notificationPreferences, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const prefs = await withTenant(db, session.workspaceId, async (tx) => {
      const [record] = await tx
        .select()
        .from(notificationPreferences)
        .where(and(eq(notificationPreferences.workspaceId, session.workspaceId), eq(notificationPreferences.userId, session.sub)))
        .limit(1);
      return (
        record ?? {
          approvalRequired: true,
          publishFailed: true,
          tokenExpired: true,
          weeklyDigest: true,
          emailNotifications: true,
          inAppNotifications: true
        }
      );
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    return apiError(error);
  }
}

const updatePrefsSchema = z.object({
  approvalRequired: z.boolean().default(true),
  publishFailed: z.boolean().default(true),
  tokenExpired: z.boolean().default(true),
  weeklyDigest: z.boolean().default(true),
  emailNotifications: z.boolean().default(true),
  inAppNotifications: z.boolean().default(true)
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const input = updatePrefsSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);

    const saved = await withTenant(db, session.workspaceId, async (tx) => {
      const [result] = await tx
        .insert(notificationPreferences)
        .values({
          workspaceId: session.workspaceId,
          userId: session.sub,
          ...input
        })
        .onConflictDoUpdate({
          target: [notificationPreferences.workspaceId, notificationPreferences.userId],
          set: {
            ...input,
            updatedAt: new Date()
          }
        })
        .returning();
      return result;
    });

    return NextResponse.json({ preferences: saved });
  } catch (error) {
    return apiError(error);
  }
}
