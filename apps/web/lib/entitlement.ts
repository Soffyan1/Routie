import { createDatabase, entitlements, withTenant } from "@routie/db";
import { evaluateEntitlement } from "@routie/domain";
import { eq } from "drizzle-orm";
import { serverEnv } from "./env";

export async function requireActiveEntitlement(workspaceId: string) {
  const db = createDatabase(serverEnv().DATABASE_URL);
  const [row] = await withTenant(db, workspaceId, (tx) => tx.select().from(entitlements).where(eq(entitlements.workspaceId, workspaceId)).limit(1));
  if (!row) throw new Error("Workspace entitlement not found");
  const decision = evaluateEntitlement(row.status === "ACTIVE", row.expiredAt);
  if (!decision.canMutate) throw new Error(`Workspace is read-only (${decision.status})`);
  return decision;
}
