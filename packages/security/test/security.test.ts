import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertSafePublicUrl, createWebhookSignature, decryptSecret, encryptSecret, verifyWebhookSignature } from "../src";

describe("secret envelope", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips only in the same tenant context", () => {
    const encrypted = encryptSecret("sk-private", key, "workspace-a:OPENAI");
    expect(encrypted).not.toContain("sk-private");
    expect(decryptSecret(encrypted, key, "workspace-a:OPENAI")).toBe("sk-private");
    expect(() => decryptSecret(encrypted, key, "workspace-b:OPENAI")).toThrow();
  });
});

describe("webhook verification", () => {
  it("rejects stale or tampered events", () => {
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    const signature = createWebhookSignature("secret", "evt-1", timestamp, "{\"ok\":true}");
    expect(verifyWebhookSignature("secret", { eventId: "evt-1", timestamp, signature }, "{\"ok\":true}", now)).toBe(true);
    expect(verifyWebhookSignature("secret", { eventId: "evt-1", timestamp, signature }, "{}", now)).toBe(false);
    expect(verifyWebhookSignature("secret", { eventId: "evt-1", timestamp, signature }, "{\"ok\":true}", now + 600_000)).toBe(false);
  });
});

describe("crawler URL safety", () => {
  it("blocks local networks and embedded credentials", () => {
    expect(() => assertSafePublicUrl("http://127.0.0.1/admin")).toThrow();
    expect(() => assertSafePublicUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => assertSafePublicUrl("https://user:pass@example.com")).toThrow();
    expect(assertSafePublicUrl("https://example.com/products").hostname).toBe("example.com");
  });
});
