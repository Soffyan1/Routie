import { and, eq, inArray } from "drizzle-orm";
import { channelVariants, contentConcepts, publishJobs, withTenant, type Database } from "@routie/db";
import type { SocialChannel } from "@routie/domain";
import { publishingQueue } from "./queue";

export async function resumeHeldSocialPublishJobs(
  db: Database,
  workspaceId: string,
  channels: SocialChannel[]
): Promise<number> {
  if (channels.length === 0) return 0;
  const jobs = await withTenant(db, workspaceId, async (tx) => {
    const held = await tx
      .select({ id: publishJobs.id, conceptId: channelVariants.conceptId })
      .from(publishJobs)
      .innerJoin(channelVariants, eq(channelVariants.id, publishJobs.variantId))
      .where(
        and(
          eq(publishJobs.workspaceId, workspaceId),
          eq(publishJobs.status, "HELD"),
          eq(publishJobs.heldReason, "SOCIAL_RECONNECT_REQUIRED"),
          inArray(channelVariants.channel, channels)
        )
      );
    if (held.length > 0) {
      await tx
        .update(publishJobs)
        .set({ status: "QUEUED", heldReason: null, lastError: null, updatedAt: new Date() })
        .where(inArray(publishJobs.id, held.map((job) => job.id)));
      await tx
        .update(contentConcepts)
        .set({ state: "SCHEDULED", heldReason: null, updatedAt: new Date() })
        .where(inArray(contentConcepts.id, [...new Set(held.map((job) => job.conceptId))]));
    }
    return held;
  });
  if (jobs.length === 0) return 0;

  try {
    const queue = publishingQueue();
    await Promise.all(
      jobs.map((job) =>
        queue.add(
          "publish",
          { workspaceId, publishJobId: job.id },
          { jobId: `reconnect-${job.id}-${Date.now()}` }
        )
      )
    );
  } catch (error) {
    await withTenant(db, workspaceId, (tx) =>
      tx
        .update(publishJobs)
        .set({ status: "HELD", heldReason: "SOCIAL_RECONNECT_REQUIRED", updatedAt: new Date() })
        .where(inArray(publishJobs.id, jobs.map((job) => job.id)))
    );
    // A temporary queue outage must not turn a successful OAuth connection into
    // a failed login. The jobs remain HELD and can be resumed by a later retry.
    console.error("[OAuth] Failed to resume held social publish jobs:", error);
    return 0;
  }
  return jobs.length;
}
