import { Queue, Worker } from "bullmq";
import { handleGenerationFailure, processGeneration } from "./generate";
import { advanceEntitlementLifecycle, archivePublishedMedia, createAutomaticPublishDigest, refreshExpiringTikTokConnections, resumePendingTikTokDraftJobs } from "./maintenance";
import { processPublish } from "./publish";
import { ProviderThrottle, RedisProviderThrottleStore } from "./provider-throttle";
import { createRedisConnection, QUEUES, type GenerateQueuePayload, type PublishQueuePayload } from "./queues";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
const connection = createRedisConnection();
function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
const providerThrottle = new ProviderThrottle(new RedisProviderThrottleStore(connection), {
  minIntervalMs: positiveInteger(process.env.AI_PROVIDER_MIN_INTERVAL_MS, 4_000),
  defaultCooldownMs: positiveInteger(process.env.AI_PROVIDER_DEFAULT_COOLDOWN_MS, 60_000)
});
const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });
await maintenanceQueue.upsertJobScheduler("hourly-entitlement-lifecycle", { every: 60 * 60_000 }, {
  name: "advance-entitlement-lifecycle",
  data: {},
  opts: { removeOnComplete: 24, removeOnFail: 168 }
});
await maintenanceQueue.upsertJobScheduler("daily-published-media-retention", { every: 24 * 60 * 60_000 }, {
  name: "archive-published-media",
  data: {},
  opts: { removeOnComplete: 30, removeOnFail: 90 }
});
await maintenanceQueue.upsertJobScheduler("daily-automatic-publish-digest", { every: 24 * 60 * 60_000 }, {
  name: "automatic-publish-digest",
  data: {},
  opts: { removeOnComplete: 30, removeOnFail: 90 }
});
await maintenanceQueue.upsertJobScheduler("six-hour-tiktok-token-refresh", { every: 6 * 60 * 60_000 }, {
  name: "refresh-tiktok-tokens",
  data: {},
  opts: { removeOnComplete: 30, removeOnFail: 90 }
});
await resumePendingTikTokDraftJobs();

const workers = [
  new Worker<GenerateQueuePayload>(QUEUES.generation, async (job) => processGeneration(job.data, providerThrottle), { connection, concurrency }),
  new Worker<PublishQueuePayload>(QUEUES.publishing, async (job) => processPublish(job.data), { connection, concurrency }),
  new Worker(QUEUES.maintenance, async (job) => {
    if (job.name === "advance-entitlement-lifecycle") return advanceEntitlementLifecycle();
    if (job.name === "archive-published-media") return archivePublishedMedia();
    if (job.name === "automatic-publish-digest") return createAutomaticPublishDigest();
    if (job.name === "refresh-tiktok-tokens") {
      const tokenRefresh = await refreshExpiringTikTokConnections();
      const resumed = await resumePendingTikTokDraftJobs();
      return { ...tokenRefresh, resumed };
    }
    throw new Error(`Unknown maintenance job: ${job.name}`);
  }, { connection, concurrency: 1 })
];

for (const worker of workers) {
  worker.on("failed", async (job, error) => {
    console.error(JSON.stringify({ level: "error", queue: worker.name, jobId: job?.id, message: error.message }));
    if (worker.name === QUEUES.generation && job?.data) {
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        await handleGenerationFailure(job.data as GenerateQueuePayload, error);
      }
    }
  });
}

async function shutdown(signal: string) {
  console.info(JSON.stringify({ level: "info", message: "Stopping Routie worker", signal }));
  await Promise.all(workers.map((worker) => worker.close()));
  await maintenanceQueue.close();
  await connection.quit();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
console.info(JSON.stringify({ level: "info", message: "Routie worker started", concurrency }));
