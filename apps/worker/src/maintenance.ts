import { eq, isNotNull } from "drizzle-orm";
import { createDatabase, entitlements, workspaces } from "@routie/db";
import { evaluateEntitlement } from "@routie/domain";
import { deletePrefix } from "@routie/storage";

export async function advanceEntitlementLifecycle(now = new Date()): Promise<{ updated: number; purged: number }> {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const expired = await db
    .select({ workspaceId: entitlements.workspaceId, status: entitlements.status, expiredAt: entitlements.expiredAt })
    .from(entitlements)
    .where(isNotNull(entitlements.expiredAt));
  let updated = 0;
  let purged = 0;
  for (const item of expired) {
    const decision = evaluateEntitlement(false, item.expiredAt, now);
    if (decision.shouldPurge) {
      await deletePrefix(`${item.workspaceId}/`);
      await db.delete(workspaces).where(eq(workspaces.id, item.workspaceId));
      purged += 1;
      continue;
    }
    if (decision.status !== item.status) {
      await db.update(entitlements).set({ status: decision.status, updatedAt: now }).where(eq(entitlements.workspaceId, item.workspaceId));
      updated += 1;
    }
  }
  return { updated, purged };
}
