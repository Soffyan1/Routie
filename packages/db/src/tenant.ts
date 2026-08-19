import { sql } from "drizzle-orm";
import type { Database } from "./client";

export type TenantTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function withTenant<T>(db: Database, workspaceId: string, callback: (tx: TenantTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`);
    return callback(tx);
  });
}

export async function assertWorkspaceMembership(db: Database, userId: string, workspaceId: string): Promise<void> {
  const rows = await db.execute(sql`
    select 1
    from memberships
    where user_id = ${userId}::uuid and workspace_id = ${workspaceId}::uuid
    limit 1
  `);
  if (rows.length === 0) throw new Error("Workspace access denied");
}

export async function setTenantContext(db: Database, workspaceId: string): Promise<void> {
  await db.execute(sql`select set_config('app.workspace_id', ${workspaceId}, false)`);
}
