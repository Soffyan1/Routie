import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookHeaders {
  eventId: string;
  timestamp: string;
  signature: string;
}

export function createWebhookSignature(secret: string, eventId: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${eventId}.${timestamp}.${rawBody}`).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  headers: WebhookHeaders,
  rawBody: string,
  now = Date.now(),
  toleranceMs = 5 * 60_000
): boolean {
  const timestampMs = Number(headers.timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > toleranceMs) return false;
  const expected = Buffer.from(createWebhookSignature(secret, headers.eventId, headers.timestamp, rawBody), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(headers.signature.replace(/^sha256=/, ""), "hex");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
