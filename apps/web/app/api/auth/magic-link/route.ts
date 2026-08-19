import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createDatabase, entitlements, magicLinks, memberships, users } from "@routie/db";
import { evaluateEntitlement } from "@routie/domain";
import { createSessionToken } from "@routie/security";
import { SESSION_COOKIE } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) throw new Error("Magic link token is missing");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);
    const claims = await db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(magicLinks)
        .where(and(eq(magicLinks.tokenHash, tokenHash), isNull(magicLinks.consumedAt), gt(magicLinks.expiresAt, new Date())))
        .limit(1);
      if (!link) throw new Error("Magic link is invalid or expired");
      const [entitlement] = await tx.select().from(entitlements).where(eq(entitlements.workspaceId, link.workspaceId)).limit(1);
      if (!entitlement) throw new Error("Workspace entitlement not found");
      const access = evaluateEntitlement(entitlement.status === "ACTIVE", entitlement.expiredAt);
      if (!access.canRead) throw new Error(`Workspace login is blocked (${access.status})`);
      const [user] = await tx
        .insert(users)
        .values({ email: link.email, name: link.email.split("@")[0] ?? "Routie member" })
        .onConflictDoUpdate({ target: users.email, set: { updatedAt: new Date() } })
        .returning();
      await tx
        .insert(memberships)
        .values({ workspaceId: link.workspaceId, userId: user!.id, role: link.role })
        .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role: link.role } });
      await tx.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, link.id));
      return { sub: user!.id, workspaceId: link.workspaceId, role: link.role, email: user!.email };
    });
    const sessionToken = await createSessionToken(claims, env.SESSION_SECRET);
    const response = NextResponse.redirect(new URL("/dashboard", env.APP_URL));
    response.cookies.set(SESSION_COOKIE, sessionToken, { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
