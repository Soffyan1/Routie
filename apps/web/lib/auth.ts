import { cookies } from "next/headers";
import { createDatabase, entitlements, memberships, withTenant } from "@routie/db";
import { and, eq } from "drizzle-orm";
import { evaluateEntitlement } from "@routie/domain";
import { verifySessionToken, type SessionClaims } from "@routie/security";
import { serverEnv } from "./env";

export const SESSION_COOKIE = "routie_session";

export async function requireSession(): Promise<SessionClaims> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const env = serverEnv();
  if (!token) {
    if (env.NODE_ENV !== "production" && env.ALLOW_DEMO_SESSION === "true") {
      return { sub: "00000000-0000-4000-8000-000000000001", workspaceId: "00000000-0000-4000-8000-000000000002", role: "OWNER", email: "demo@routie.local" };
    }
    throw new Error("Session is required");
  }
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  const db = createDatabase(env.DATABASE_URL);
  const { membership, entitlement } = await withTenant(db, session.workspaceId, async (tx) => ({
    membership: (await tx.select({ role: memberships.role }).from(memberships).where(and(eq(memberships.userId, session.sub), eq(memberships.workspaceId, session.workspaceId))).limit(1))[0],
    entitlement: (await tx.select().from(entitlements).where(eq(entitlements.workspaceId, session.workspaceId)).limit(1))[0]
  }));
  if (!membership || membership.role !== session.role) throw new Error("Workspace access denied");
  if (!entitlement) throw new Error("Workspace entitlement not found");
  const access = evaluateEntitlement(entitlement.status === "ACTIVE", entitlement.expiredAt);
  if (!access.canRead) throw new Error(`Workspace access is blocked (${access.status})`);
  return session;
}
