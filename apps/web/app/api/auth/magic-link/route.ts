import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, entitlements, magicLinks, memberships, users, workspaces } from "@routie/db";
import type { WorkspaceRole } from "@routie/domain";
import { evaluateEntitlement } from "@routie/domain";
import { createSessionToken } from "@routie/security";
import { SESSION_COOKIE } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { sendMagicLink } from "@/lib/email";

const requestMagicLinkSchema = z.object({
  email: z.string().email("Format email tidak valid").toLowerCase().trim(),
  name: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const input = requestMagicLinkSchema.parse(await request.json());
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);

    // Find or prepare workspace for this email
    const { token, userName } = await db.transaction(async (tx) => {
      // 1. Check if user already exists
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      let targetUserId: string;
      let targetUserName: string;
      let targetWorkspaceId: string;
      let userRole: WorkspaceRole = "OWNER";

      if (existingUser) {
        targetUserId = existingUser.id;
        targetUserName = existingUser.name;

        // Find user's existing membership
        const [membership] = await tx
          .select()
          .from(memberships)
          .where(eq(memberships.userId, existingUser.id))
          .limit(1);

        if (membership) {
          targetWorkspaceId = membership.workspaceId;
          userRole = membership.role;
        } else {
          // Create workspace if user had no workspace
          const [newWs] = await tx
            .insert(workspaces)
            .values({
              externalCustomerId: `cust_${randomBytes(8).toString("hex")}`,
              name: `${existingUser.name || input.email.split("@")[0]}'s Workspace`
            })
            .returning();

          if (!newWs) throw new Error("Gagal membuat workspace.");
          targetWorkspaceId = newWs.id;

          await tx.insert(memberships).values({
            workspaceId: targetWorkspaceId,
            userId: targetUserId,
            role: "OWNER"
          });
          await tx.insert(entitlements).values({
            workspaceId: targetWorkspaceId,
            status: "ACTIVE"
          });
        }
      } else {
        // Brand new user from Landing Page / Registration
        const defaultName = input.name?.trim() || input.email.split("@")[0] || "User";
        const [newUser] = await tx
          .insert(users)
          .values({ email: input.email, name: defaultName })
          .onConflictDoUpdate({ target: users.email, set: { updatedAt: new Date() } })
          .returning();

        if (!newUser) throw new Error("Gagal membuat user baru.");
        targetUserId = newUser.id;
        targetUserName = defaultName;

        const [newWs] = await tx
          .insert(workspaces)
          .values({
            externalCustomerId: `cust_${randomBytes(8).toString("hex")}`,
            name: `${defaultName}'s Workspace`
          })
          .returning();

        if (!newWs) throw new Error("Gagal membuat workspace baru.");
        targetWorkspaceId = newWs.id;

        await tx.insert(memberships).values({
          workspaceId: targetWorkspaceId,
          userId: targetUserId,
          role: "OWNER"
        });

        await tx.insert(entitlements).values({
          workspaceId: targetWorkspaceId,
          status: "ACTIVE"
        });
      }

      // 2. Generate secure token
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await tx.insert(magicLinks).values({
        workspaceId: targetWorkspaceId,
        email: input.email,
        tokenHash,
        role: userRole,
        expiresAt
      });

      return {
        token: rawToken,
        workspaceId: targetWorkspaceId,
        userName: targetUserName
      };
    });

    // 3. Send email with Magic Link URL
    const magicLinkUrl = `${env.APP_URL}/api/auth/magic-link?token=${token}`;
    await sendMagicLink(input.email, magicLinkUrl, userName);

    return NextResponse.json({
      success: true,
      message: "Tautan masuk aman telah dikirim ke email Anda. Silakan periksa inbox / spam Gmail Anda."
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) throw new Error("Token magic link tidak ditemukan atau telah kedaluwarsa.");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);

    const claims = await db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(magicLinks)
        .where(and(eq(magicLinks.tokenHash, tokenHash), isNull(magicLinks.consumedAt), isNull(magicLinks.revokedAt), gt(magicLinks.expiresAt, new Date())))
        .limit(1);
      if (!link) throw new Error("Tautan masuk tidak valid atau sudah kedaluwarsa.");

      const [entitlement] = await tx.select().from(entitlements).where(eq(entitlements.workspaceId, link.workspaceId)).limit(1);
      if (!entitlement) throw new Error("Workspace tidak ditemukan.");
      const access = evaluateEntitlement(entitlement.status === "ACTIVE", entitlement.expiredAt);
      if (!access.canRead) throw new Error(`Akses workspace dibatasi (${access.status})`);

      const [user] = await tx
        .insert(users)
        .values({ email: link.email, name: link.email.split("@")[0] ?? "Routie member" })
        .onConflictDoUpdate({ target: users.email, set: { updatedAt: new Date() } })
        .returning();

      if (!user) throw new Error("User record could not be loaded");

      if (link.purpose === "TEAM_INVITE") {
        const [existingMembership] = await tx
          .select({ role: memberships.role })
          .from(memberships)
          .where(and(eq(memberships.workspaceId, link.workspaceId), eq(memberships.userId, user.id)))
          .limit(1);
        const memberRole = existingMembership?.role ?? link.role;
        if (!existingMembership) {
          await tx.insert(memberships).values({
            workspaceId: link.workspaceId,
            userId: user.id,
            role: link.role
          });
        }
        await tx.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, link.id));
        return { sub: user.id, workspaceId: link.workspaceId, role: memberRole, email: user.email };
      }

      await tx
        .insert(memberships)
        .values({ workspaceId: link.workspaceId, userId: user.id, role: link.role })
        .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role: link.role } });

      await tx.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, link.id));
      return { sub: user.id, workspaceId: link.workspaceId, role: link.role, email: user.email };
    });

    const sessionToken = await createSessionToken(claims, env.SESSION_SECRET);
    const response = NextResponse.redirect(new URL("/dashboard", env.APP_URL));
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });
    return response;
  } catch (error) {
    const env = serverEnv();
    const msg = error instanceof Error ? error.message : "Gagal memproses tautan masuk.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, env.APP_URL));
  }
}
