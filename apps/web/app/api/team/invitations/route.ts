import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, magicLinks, memberships, users, workspaces, withTenant } from "@routie/db";
import { hasWorkspacePermission } from "@routie/domain";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { sendMagicLink } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const invitationSchema = z.object({
  action: z.enum(["create", "resend"]).default("create"),
  email: z.email().toLowerCase().trim().optional(),
  role: z.enum(["EDITOR", "APPROVER"]).optional(),
  invitationId: z.uuid().optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (!hasWorkspacePermission(session.role, "MANAGE_TEAM")) throw new Error("Only the owner can invite team members");
    const input = invitationSchema.parse(await request.json());
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);
    let email: string;
    let role: "EDITOR" | "APPROVER";
    let invitationId: string;
    let token: string;

    if (input.action === "resend") {
      if (!input.invitationId) throw new Error("ID undangan diperlukan untuk mengirim ulang.");
      const result = await withTenant(db, session.workspaceId, async (tx) => {
        const [existing] = await tx.select().from(magicLinks).where(and(
          eq(magicLinks.id, input.invitationId!),
          eq(magicLinks.workspaceId, session.workspaceId),
          eq(magicLinks.purpose, "TEAM_INVITE"),
          isNull(magicLinks.consumedAt),
          isNull(magicLinks.revokedAt),
          gt(magicLinks.expiresAt, new Date())
        )).limit(1);
        if (!existing) throw new Error("Undangan tidak ditemukan atau sudah tidak aktif.");
        const nextToken = randomBytes(32).toString("base64url");
        const [created] = await tx.insert(magicLinks).values({
          workspaceId: session.workspaceId,
          email: existing.email,
          role: existing.role,
          purpose: "TEAM_INVITE",
          invitedBy: session.sub,
          tokenHash: createHash("sha256").update(nextToken).digest("hex"),
          expiresAt: new Date(Date.now() + 15 * 60_000)
        }).returning({ id: magicLinks.id });
        await tx.update(magicLinks).set({ revokedAt: new Date() }).where(eq(magicLinks.id, existing.id));
        if (!created) throw new Error("Gagal membuat ulang undangan.");
        return { email: existing.email, role: existing.role as "EDITOR" | "APPROVER", id: created.id, token: nextToken };
      });
      email = result.email;
      role = result.role;
      invitationId = result.id;
      token = result.token;
    } else {
      if (!input.email || !input.role) throw new Error("Email dan role undangan wajib diisi.");
      email = input.email;
      role = input.role;
      const result = await withTenant(db, session.workspaceId, async (tx) => {
        const [[membershipCount], [pendingCount], [workspace], [existingMember], [existingInvite]] = await Promise.all([
          tx.select({ value: count() }).from(memberships).where(eq(memberships.workspaceId, session.workspaceId)),
          tx.select({ value: count() }).from(magicLinks).where(and(eq(magicLinks.workspaceId, session.workspaceId), eq(magicLinks.purpose, "TEAM_INVITE"), isNull(magicLinks.consumedAt), isNull(magicLinks.revokedAt), gt(magicLinks.expiresAt, new Date()))),
          tx.select({ maxMembers: workspaces.maxMembers }).from(workspaces).where(eq(workspaces.id, session.workspaceId)).limit(1),
          tx.select({ id: users.id }).from(users).innerJoin(memberships, eq(memberships.userId, users.id)).where(and(eq(memberships.workspaceId, session.workspaceId), eq(users.email, email))).limit(1),
          tx.select({ id: magicLinks.id }).from(magicLinks).where(and(eq(magicLinks.workspaceId, session.workspaceId), eq(magicLinks.email, email), eq(magicLinks.purpose, "TEAM_INVITE"), isNull(magicLinks.consumedAt), isNull(magicLinks.revokedAt), gt(magicLinks.expiresAt, new Date()))).limit(1)
        ]);
        if (!workspace || (membershipCount?.value ?? 0) + (pendingCount?.value ?? 0) >= workspace.maxMembers) throw new Error("Batas anggota workspace sudah tercapai.");
        if (existingMember) throw new Error("Email tersebut sudah menjadi anggota workspace.");
        if (existingInvite) throw new Error("Undangan aktif untuk email tersebut sudah tersedia.");
        const nextToken = randomBytes(32).toString("base64url");
        const [created] = await tx.insert(magicLinks).values({
          workspaceId: session.workspaceId,
          email,
          role,
          purpose: "TEAM_INVITE",
          invitedBy: session.sub,
          tokenHash: createHash("sha256").update(nextToken).digest("hex"),
          expiresAt: new Date(Date.now() + 15 * 60_000)
        }).returning({ id: magicLinks.id });
        if (!created) throw new Error("Gagal membuat undangan.");
        return { id: created.id, token: nextToken };
      });
      invitationId = result.id;
      token = result.token;
    }
    const url = new URL("/api/auth/magic-link", env.APP_URL);
    url.searchParams.set("token", token);
    await sendMagicLink(email, url.toString(), undefined, "TEAM_INVITE");
    return NextResponse.json({ invited: true, invitationId, role, ...(env.NODE_ENV !== "production" ? { developmentUrl: url.toString() } : {}) }, { status: input.action === "resend" ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (!hasWorkspacePermission(session.role, "MANAGE_TEAM")) throw new Error("Only the owner can cancel team invitations");
    const input = z.object({ invitationId: z.uuid() }).parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);
    await withTenant(db, session.workspaceId, async (tx) => {
      await tx.update(magicLinks).set({ revokedAt: new Date() }).where(and(
        eq(magicLinks.id, input.invitationId),
        eq(magicLinks.workspaceId, session.workspaceId),
        eq(magicLinks.purpose, "TEAM_INVITE"),
        isNull(magicLinks.consumedAt),
        isNull(magicLinks.revokedAt)
      ));
    });
    return NextResponse.json({ canceled: true });
  } catch (error) {
    return apiError(error);
  }
}
