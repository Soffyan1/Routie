import type IORedis from "ioredis";
import { ProviderRequestError } from "@routie/providers";

export interface ProviderThrottleStore {
  acquireLock(key: string, token: string, ttlMs: number): Promise<boolean>;
  getTimestamp(key: string): Promise<number | null>;
  setTimestamp(key: string, timestamp: number, ttlMs: number): Promise<void>;
  setTimestampIfLater(key: string, timestamp: number, ttlMs: number): Promise<void>;
  releaseLock(key: string, token: string): Promise<void>;
}

export class RedisProviderThrottleStore implements ProviderThrottleStore {
  constructor(private readonly redis: IORedis) {}

  async acquireLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.set(key, token, "PX", ttlMs, "NX")) === "OK";
  }

  async getTimestamp(key: string): Promise<number | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async setTimestamp(key: string, timestamp: number, ttlMs: number): Promise<void> {
    await this.redis.set(key, String(timestamp), "PX", ttlMs);
  }

  async setTimestampIfLater(key: string, timestamp: number, ttlMs: number): Promise<void> {
    await this.redis.eval(
      `local current = tonumber(redis.call("get", KEYS[1]) or "0")
       local requested = tonumber(ARGV[1])
       if requested > current then
         redis.call("psetex", KEYS[1], ARGV[2], ARGV[1])
       end
       return 1`,
      1,
      key,
      timestamp,
      ttlMs
    );
  }

  async releaseLock(key: string, token: string): Promise<void> {
    await this.redis.eval(
      `if redis.call("get", KEYS[1]) == ARGV[1] then
         return redis.call("del", KEYS[1])
       end
       return 0`,
      1,
      key,
      token
    );
  }
}

type ProviderThrottleOptions = {
  minIntervalMs?: number;
  defaultCooldownMs?: number;
  maxCooldownMs?: number;
  lockTtlMs?: number;
  lockWaitTimeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
};

function normalizedError(error: unknown) {
  return (error as {
    normalized?: {
      code?: string;
      retryAfterMs?: number;
      details?: { httpStatus?: number };
    };
  }).normalized;
}

export function isProviderRateLimit(error: unknown): boolean {
  const normalized = normalizedError(error);
  return (
    normalized?.details?.httpStatus === 429 ||
    normalized?.code === "HTTP_429" ||
    normalized?.code === "RESOURCE_EXHAUSTED" ||
    normalized?.code === "PROVIDER_COOLDOWN" ||
    (error instanceof Error && error.message.includes("(429)"))
  );
}

export class ProviderThrottle {
  private readonly minIntervalMs: number;
  private readonly defaultCooldownMs: number;
  private readonly maxCooldownMs: number;
  private readonly lockTtlMs: number;
  private readonly lockWaitTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (delayMs: number) => Promise<void>;

  constructor(private readonly store: ProviderThrottleStore, options: ProviderThrottleOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 4_000;
    this.defaultCooldownMs = options.defaultCooldownMs ?? 60_000;
    this.maxCooldownMs = options.maxCooldownMs ?? 5 * 60_000;
    this.lockTtlMs = options.lockTtlMs ?? 10 * 60_000;
    this.lockWaitTimeoutMs = options.lockWaitTimeoutMs ?? 10 * 60_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async run<T>(credentialScope: string, operation: () => Promise<T>): Promise<T> {
    const safeScope = credentialScope.replace(/[^a-zA-Z0-9:_-]/g, "");
    const lockKey = `routie:provider-throttle:${safeScope}:lock`;
    const cooldownKey = `routie:provider-throttle:${safeScope}:cooldown`;
    const lastRequestKey = `routie:provider-throttle:${safeScope}:last-request`;
    const token = `${process.pid}:${this.now()}:${Math.random().toString(36).slice(2)}`;
    const waitDeadline = this.now() + this.lockWaitTimeoutMs;

    while (!(await this.store.acquireLock(lockKey, token, this.lockTtlMs))) {
      if (this.now() >= waitDeadline) {
        throw new ProviderRequestError({
          code: "PROVIDER_THROTTLE_TIMEOUT",
          message: "Antrean AI sedang sangat padat. Silakan coba kembali beberapa saat lagi.",
          retryable: true
        });
      }
      await this.sleep(this.pollIntervalMs);
    }

    try {
      const [cooldownUntil, lastRequestAt] = await Promise.all([
        this.store.getTimestamp(cooldownKey),
        this.store.getTimestamp(lastRequestKey)
      ]);
      const now = this.now();
      if (cooldownUntil && cooldownUntil > now) {
        throw new ProviderRequestError({
          code: "PROVIDER_COOLDOWN",
          message: "Layanan AI sedang dalam masa jeda setelah membatasi permintaan. Coba lagi beberapa menit lagi.",
          retryable: true,
          retryAfterMs: cooldownUntil - now,
          details: { httpStatus: 429 }
        });
      }
      const spacingDelayMs = (lastRequestAt ?? 0) + this.minIntervalMs - now;
      if (spacingDelayMs > 0) await this.sleep(spacingDelayMs);

      await this.store.setTimestamp(lastRequestKey, this.now(), this.lockTtlMs);
      try {
        return await operation();
      } catch (error) {
        if (isProviderRateLimit(error)) {
          const requestedDelay = normalizedError(error)?.retryAfterMs ?? this.defaultCooldownMs;
          const cooldownMs = Math.max(this.minIntervalMs, Math.min(requestedDelay, this.maxCooldownMs));
          await this.store.setTimestampIfLater(cooldownKey, this.now() + cooldownMs, this.lockTtlMs);
        }
        throw error;
      }
    } finally {
      await this.store.releaseLock(lockKey, token);
    }
  }
}
