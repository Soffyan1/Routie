import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalQueue = globalThis as typeof globalThis & { routieRedis?: IORedis; routiePublishQueue?: Queue; routieGenerationQueue?: Queue };

function redisConnection() {
  globalQueue.routieRedis ??= new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
  return globalQueue.routieRedis;
}

export function publishingQueue() {
  globalQueue.routiePublishQueue ??= new Queue("routie-publishing", {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 3_000
      },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1_000 }
    }
  });
  return globalQueue.routiePublishQueue;
}

export function generationQueue() {
  globalQueue.routieGenerationQueue ??= new Queue("routie-generation", {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 3_000
      },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1_000 }
    }
  });
  return globalQueue.routieGenerationQueue;
}
