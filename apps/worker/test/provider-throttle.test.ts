import { describe, expect, it, vi } from "vitest";
import { ProviderRequestError } from "@routie/providers";
import {
  ProviderThrottle,
  type ProviderThrottleStore,
  isProviderRateLimit
} from "../src/provider-throttle";

class MemoryThrottleStore implements ProviderThrottleStore {
  readonly locks = new Map<string, string>();
  readonly timestamps = new Map<string, number>();

  async acquireLock(key: string, token: string): Promise<boolean> {
    if (this.locks.has(key)) return false;
    this.locks.set(key, token);
    return true;
  }

  async getTimestamp(key: string): Promise<number | null> {
    return this.timestamps.get(key) ?? null;
  }

  async setTimestamp(key: string, timestamp: number): Promise<void> {
    this.timestamps.set(key, timestamp);
  }

  async setTimestampIfLater(key: string, timestamp: number): Promise<void> {
    this.timestamps.set(key, Math.max(timestamp, this.timestamps.get(key) ?? 0));
  }

  async releaseLock(key: string, token: string): Promise<void> {
    if (this.locks.get(key) === token) this.locks.delete(key);
  }
}

describe("ProviderThrottle", () => {
  it("shares a provider cooldown across jobs using the same credential", async () => {
    const store = new MemoryThrottleStore();
    let now = 1_000;
    const sleeps: number[] = [];
    const throttle = new ProviderThrottle(store, {
      minIntervalMs: 100,
      defaultCooldownMs: 2_000,
      maxCooldownMs: 10_000,
      now: () => now,
      sleep: async (delayMs) => {
        sleeps.push(delayMs);
        now += delayMs;
      }
    });

    await expect(
      throttle.run("workspace:credential", async () => {
        throw new ProviderRequestError({
          code: "RESOURCE_EXHAUSTED",
          message: "rate limited",
          retryable: true,
          provider: "GEMINI",
          retryAfterMs: 3_000,
          details: { httpStatus: 429 }
        });
      })
    ).rejects.toMatchObject({ normalized: { code: "RESOURCE_EXHAUSTED" } });

    const blockedOperation = vi.fn(async () => "should-not-run");
    await expect(throttle.run("workspace:credential", blockedOperation)).rejects.toMatchObject({
      normalized: { code: "PROVIDER_COOLDOWN", retryAfterMs: 3_000 }
    });
    expect(blockedOperation).not.toHaveBeenCalled();

    now += 3_000;
    await expect(throttle.run("workspace:credential", async () => "ok")).resolves.toBe("ok");
    expect(sleeps).toEqual([]);
    expect(store.locks.size).toBe(0);
  });

  it("recognizes normalized and legacy 429 errors", () => {
    expect(
      isProviderRateLimit(
        new ProviderRequestError({
          code: "HTTP_429",
          message: "limited",
          retryable: true,
          details: { httpStatus: 429 }
        })
      )
    ).toBe(true);
    expect(isProviderRateLimit(new Error("Provider request failed (429)"))).toBe(true);
    expect(isProviderRateLimit(new Error("invalid prompt"))).toBe(false);
  });
});
