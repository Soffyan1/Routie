import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUES = {
  generation: "routie-generation",
  publishing: "routie-publishing",
  maintenance: "routie-maintenance"
} as const;

export function createRedisConnection(url = process.env.REDIS_URL ?? "redis://localhost:6379") {
  return new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

const defaultJobOptions: JobsOptions = {
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 7 * 86_400, count: 5_000 }
};

export function createQueues(connection = createRedisConnection()) {
  return {
    generation: new Queue(QUEUES.generation, {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2, backoff: { type: "exponential", delay: 15_000 } }
    }),
    publishing: new Queue(QUEUES.publishing, { connection, defaultJobOptions: { ...defaultJobOptions, attempts: 3 } }),
    maintenance: new Queue(QUEUES.maintenance, { connection, defaultJobOptions: { ...defaultJobOptions, attempts: 1 } })
  };
}

export interface PublishQueuePayload {
  workspaceId: string;
  publishJobId: string;
}

export interface GenerateQueuePayload {
  workspaceId: string;
  credentialId: string;
  request: import("@routie/domain").GenerateRequest;
  target?:
    | {
        kind: "CALENDAR_IDEAS";
        calendarId: string;
        conceptIds: string[];
      }
    | {
        kind: "CONCEPT_MEDIA";
        conceptId: string;
      };
}
