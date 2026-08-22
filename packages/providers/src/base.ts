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
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    throw new ProviderRequestError({
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Provider network request failed",
      retryable: true,
      provider
    });
  }

  if (response.ok) return response;

  const body = (await response.text()).slice(0, 2_000);
  const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
  const isRetryable = response.status === 429 || response.status === 408 || response.status === 409 || response.status >= 500;
  const parsed = parseProviderErrorBody(body);
  const message =
    response.status === 429
      ? "Layanan AI sedang membatasi permintaan. Routie akan memberi jeda sebelum mencoba kembali."
      : parsed.message || `Provider request failed (${response.status})`;

  throw new ProviderRequestError({
    code: parsed.code || `HTTP_${response.status}`,
    message,
    retryable: isRetryable,
    provider,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    details: { httpStatus: response.status, sanitizedBody: redactSecrets(body) }
  });
}

function parseProviderErrorBody(body: string): { code?: string; message?: string } {
  try {
    const parsed = JSON.parse(body) as {
      code?: string;
      message?: string;
      error?: string | { code?: string | number; status?: string; message?: string };
    };
    if (typeof parsed.error === "string") {
      return { ...(parsed.code ? { code: parsed.code } : {}), message: parsed.error };
    }
    const code = parsed.error?.status || String(parsed.error?.code ?? parsed.code ?? "");
    const message = parsed.error?.message || parsed.message;
    return {
      ...(code ? { code } : {}),
      ...(message ? { message } : {})
    };
  } catch {
    return {};
  }
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

export function toDataUrl(mimeType: string, bytes: ArrayBuffer | Uint8Array | string): string {
  const base64 =
    typeof bytes === "string"
      ? bytes
      : Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
