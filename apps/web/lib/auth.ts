import { cookies } from "next/headers";
import { createDatabase, entitlements, memberships, withTenant } from "@routie/db";
import { and, eq } from "drizzle-orm";
import { evaluateEntitlement } from "@routie/domain";
import { verifySessionToken, type SessionClaims } from "@routie/security";
import { serverEnv } from "./env";

export const SESSION_COOKIE = "routie_session";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session has expired");
    this.name = "SessionExpiredError";
  }
}

export function isSessionAuthError(error: unknown): boolean {
  if (error instanceof SessionExpiredError) return true;
  const message = error instanceof Error ? error.message : "";
  return /session is required|session has expired/i.test(message);
}

export async function requireSession(): Promise<SessionClaims> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const env = serverEnv();
  if (!token) {
    if (env.NODE_ENV !== "production" && env.ALLOW_DEMO_SESSION === "true") {
      return { sub: "00000000-0000-4000-8000-000000000001", workspaceId: "00000000-0000-4000-8000-000000000002", role: "OWNER", email: "demo@routie.local" };
    }
    throw new Error("Session is required");
  }
  let session: SessionClaims;
  try {
    session = await verifySessionToken(token, env.SESSION_SECRET);
  } catch (error) {
    const errorCode = typeof error === "object" && error ? (error as { code?: string }).code : undefined;
    if (errorCode === "ERR_JWT_EXPIRED" || /"exp" claim timestamp check failed/i.test(error instanceof Error ? error.message : "")) {
      throw new SessionExpiredError();
    }
    throw error;
  }
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
