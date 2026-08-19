import type { NormalizedError, ProviderCapability, ProviderModel } from "@routie/domain";

export class ProviderRequestError extends Error {
  readonly normalized: NormalizedError;

  constructor(normalized: NormalizedError) {
    super(normalized.message);
    this.name = "ProviderRequestError";
    this.normalized = normalized;
  }
}

export async function providerFetch(provider: string, url: string, init: RequestInit): Promise<Response> {
  const maxRetries = 4;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
      if (response.ok) {
        return response;
      }

      // Retryable HTTP status codes
      const isRetryable = response.status === 429 || response.status === 408 || response.status === 409 || response.status >= 500;
      if (isRetryable && attempt < maxRetries) {
        const headerRetry = parseRetryAfter(response.headers.get("retry-after"));
        const jitter = Math.floor(Math.random() * 500);
        const retryDelayMs = headerRetry || (attempt * 2_000 + jitter);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      const body = (await response.text()).slice(0, 2_000);
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      throw new ProviderRequestError({
        code: `HTTP_${response.status}`,
        message: `Provider request failed (${response.status})`,
        retryable: isRetryable,
        provider,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        details: { sanitizedBody: redactSecrets(body) }
      });
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        if (error.normalized.retryable && attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 500);
          await new Promise((resolve) => setTimeout(resolve, attempt * 2_000 + jitter));
          continue;
        }
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_500 + jitter));
        continue;
      }
    }
  }

  throw new ProviderRequestError({
    code: "NETWORK_ERROR",
    message: lastError?.message || "Provider network request failed",
    retryable: true,
    provider
  });
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}

export function redactSecrets(value: string): string {
  return value
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/AIza[a-zA-Z0-9_-]{12,}/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

export function assertCapability(models: readonly ProviderModel[], model: string, capability: ProviderCapability): void {
  const entry = models.find((candidate) => candidate.id === model);
  if (!entry) throw new Error(`Model ${model} is not in Routie's allowlist`);
  if (!entry.capabilities.includes(capability)) throw new Error(`Model ${model} does not support ${capability}`);
  if (entry.lifecycle === "DEPRECATED") throw new Error(`Model ${model} is deprecated`);
}

export function toDataUrl(mimeType: string, bytes: ArrayBuffer | string): string {
  const base64 = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
