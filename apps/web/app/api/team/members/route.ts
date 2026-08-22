import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, magicLinks, memberships, users, withTenant } from "@routie/db";
import { hasWorkspacePermission } from "@routie/domain";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const data = await withTenant(db, session.workspaceId, async (tx) => {
      const [activeMembers, pendingInvites] = await Promise.all([
        tx
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: memberships.role,
            joinedAt: memberships.joinedAt
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(eq(memberships.workspaceId, session.workspaceId)),
        tx
          .select({
            id: magicLinks.id,
            email: magicLinks.email,
            role: magicLinks.role,
            expiresAt: magicLinks.expiresAt,
            createdAt: magicLinks.createdAt
          })
          .from(magicLinks)
          .where(and(
            eq(magicLinks.workspaceId, session.workspaceId),
            eq(magicLinks.purpose, "TEAM_INVITE"),
            isNull(magicLinks.consumedAt),
            isNull(magicLinks.revokedAt),
            gt(magicLinks.expiresAt, new Date())
          ))
      ]);

      return {
        members: activeMembers,
        invitations: session.role === "OWNER" ? pendingInvites : [],
        canManage: session.role === "OWNER"
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["EDITOR", "APPROVER"])
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!hasWorkspacePermission(session.role, "MANAGE_TEAM")) {
      throw new Error("Only workspace owners can modify member roles");
    }
    const input = updateRoleSchema.parse(await request.json());
    if (input.userId === session.sub) {
      throw new Error("Cannot modify owner role");
    }

    const db = createDatabase(serverEnv().DATABASE_URL);
    await withTenant(db, session.workspaceId, async (tx) => {
      const updated = await tx
        .update(memberships)
        .set({ role: input.role })
        .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, input.userId)));
      if (updated.count === 0) throw new Error("Anggota tidak ditemukan di workspace ini.");
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

const deleteMemberSchema = z.object({
  userId: z.string().uuid()
});

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!hasWorkspacePermission(session.role, "MANAGE_TEAM")) {
      throw new Error("Only workspace owners can remove members");
    }
    const input = deleteMemberSchema.parse(await request.json());
    if (input.userId === session.sub) {
      throw new Error("Cannot remove workspace owner");
    }

    const db = createDatabase(serverEnv().DATABASE_URL);
    await withTenant(db, session.workspaceId, async (tx) => {
      const deleted = await tx
        .delete(memberships)
        .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, input.userId)));
      if (deleted.count === 0) throw new Error("Anggota tidak ditemukan di workspace ini.");
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
