import { and, eq } from "drizzle-orm";
import { channelVariants, publishJobs, socialConnections, type TenantTransaction } from "@routie/db";

export type PreparedPublishJob = {
  id: string;
  scheduledFor: Date;
  queued: boolean;
};

/**
 * Creates one durable publish job per channel. Channels without an active
 * connection stay HELD instead of being silently exported or marked published.
 * The existing reconnect flow resumes them after the user connects the channel.
 */
export async function preparePublishJobs(
  tx: TenantTransaction,
  input: { workspaceId: string; conceptId: string; scheduledFor: Date }
): Promise<PreparedPublishJob[]> {
  const [variants, connections] = await Promise.all([
    tx
      .select()
      .from(channelVariants)
      .where(and(eq(channelVariants.workspaceId, input.workspaceId), eq(channelVariants.conceptId, input.conceptId))),
    tx.select().from(socialConnections).where(eq(socialConnections.workspaceId, input.workspaceId))
  ]);

  const jobs: PreparedPublishJob[] = [];
  for (const variant of variants.filter((item) => item.approvedAt && !item.rejectedAt)) {
    const connection = connections.find(
      (candidate) =>
        candidate.channel === variant.channel &&
        !candidate.disconnectedAt &&
        !candidate.reauthorizationRequiredAt &&
        Boolean(candidate.encryptedAccessToken)
    );
    const queued = Boolean(connection);
    const [job] = await tx
      .insert(publishJobs)
      .values({
        workspaceId: input.workspaceId,
        variantId: variant.id,
        connectionId: connection?.id,
        scheduledFor: input.scheduledFor,
        status: queued ? "QUEUED" : "HELD",
        heldReason: queued ? null : "SOCIAL_RECONNECT_REQUIRED",
        idempotencyKey: `${variant.id}:${input.scheduledFor.toISOString()}:v${variant.version}`
      })
      .onConflictDoNothing({ target: publishJobs.idempotencyKey })
      .returning();
    if (job) jobs.push({ id: job.id, scheduledFor: job.scheduledFor, queued });
  }
  return jobs;
}
