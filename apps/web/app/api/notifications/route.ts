import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, notifications, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const db = createDatabase(serverEnv().DATABASE_URL);

    const result = await withTenant(db, session.workspaceId, async (tx) => {
      const baseConditions = [eq(notifications.workspaceId, session.workspaceId)];
      if (unreadOnly) {
        baseConditions.push(isNull(notifications.readAt));
      }

      const [items, unreadCountResult] = await Promise.all([
        tx
          .select()
          .from(notifications)
          .where(and(...baseConditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(
            and(
              eq(notifications.workspaceId, session.workspaceId),
              isNull(notifications.readAt)
            )
          )
      ]);

      return {
        notifications: items,
        unreadCount: unreadCountResult[0]?.count ?? 0
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional()
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const input = patchSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);

    const updated = await withTenant(db, session.workspaceId, async (tx) => {
      const now = new Date();

      if (input.all) {
        const result = await tx
          .update(notifications)
          .set({ readAt: now })
          .where(
            and(
              eq(notifications.workspaceId, session.workspaceId),
              isNull(notifications.readAt)
            )
          )
          .returning({ id: notifications.id });
        return result.length;
      }

      if (input.id) {
        const result = await tx
          .update(notifications)
          .set({ readAt: now })
          .where(
            and(
              eq(notifications.workspaceId, session.workspaceId),
              eq(notifications.id, input.id)
            )
          )
          .returning({ id: notifications.id });
        return result.length;
      }

      if (input.ids && input.ids.length > 0) {
        const result = await tx
          .update(notifications)
          .set({ readAt: now })
          .where(
            and(
              eq(notifications.workspaceId, session.workspaceId),
              inArray(notifications.id, input.ids)
            )
          )
          .returning({ id: notifications.id });
        return result.length;
      }

      return 0;
    });

    return NextResponse.json({ success: true, updatedCount: updated });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all") === "true";

    const db = createDatabase(serverEnv().DATABASE_URL);

    await withTenant(db, session.workspaceId, async (tx) => {
      if (all) {
        await tx
          .delete(notifications)
          .where(eq(notifications.workspaceId, session.workspaceId));
      } else if (id) {
        await tx
          .delete(notifications)
          .where(
            and(
              eq(notifications.workspaceId, session.workspaceId),
              eq(notifications.id, id)
            )
          );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
