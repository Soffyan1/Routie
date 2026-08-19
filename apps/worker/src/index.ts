import { Queue, Worker } from "bullmq";
import { handleGenerationFailure, processGeneration } from "./generate";
import { advanceEntitlementLifecycle } from "./maintenance";
import { processPublish } from "./publish";
import { createRedisConnection, QUEUES, type GenerateQueuePayload, type PublishQueuePayload } from "./queues";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
const connection = createRedisConnection();
const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });
await maintenanceQueue.upsertJobScheduler("hourly-entitlement-lifecycle", { every: 60 * 60_000 }, {
  name: "advance-entitlement-lifecycle",
  data: {},
  opts: { removeOnComplete: 24, removeOnFail: 168 }
});

const workers = [
  new Worker<GenerateQueuePayload>(QUEUES.generation, async (job) => processGeneration(job.data), { connection, concurrency }),
  new Worker<PublishQueuePayload>(QUEUES.publishing, async (job) => processPublish(job.data), { connection, concurrency }),
  new Worker(QUEUES.maintenance, async (job) => {
    if (job.name === "advance-entitlement-lifecycle") return advanceEntitlementLifecycle();
    throw new Error(`Unknown maintenance job: ${job.name}`);
  }, { connection, concurrency: 1 })
];

for (const worker of workers) {
  worker.on("failed", async (job, error) => {
    console.error(JSON.stringify({ level: "error", queue: worker.name, jobId: job?.id, message: error.message }));
    if (worker.name === QUEUES.generation && job?.data) {
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        await handleGenerationFailure(job.data as GenerateQueuePayload, error.message);
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
