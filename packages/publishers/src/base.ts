import type { NormalizedError, PublishRequest, SocialCapability } from "@routie/domain";

export class PublishRequestError extends Error {
  readonly normalized: NormalizedError;

  constructor(normalized: NormalizedError) {
    super(normalized.message);
    this.name = "PublishRequestError";
    this.normalized = normalized;
  }
}

export function validateAgainstCapability(request: PublishRequest, capability: SocialCapability): void {
  if (request.channel !== capability.channel) throw new Error(`Wrong publisher for ${request.channel}`);
  if (!capability.contentKinds.includes(request.contentKind)) throw new Error(`${request.contentKind} is not supported on ${request.channel}`);
  if (request.caption.length > 10_000) throw new Error("Caption exceeds Routie's safety limit");
  if (request.contentKind !== "TEXT" && request.mediaUrls.length === 0) throw new Error("Media is required for this content kind");
}

export async function publishFetch(channel: string, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    throw new PublishRequestError({
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Social platform network request failed",
      retryable: true,
      provider: channel
    });
  }
  if (!response.ok) {
    const sanitizedBody = (await response.text()).slice(0, 1500).replace(/access_token=[^&\s]+/g, "access_token=[REDACTED]");
    throw new PublishRequestError({
      code: `HTTP_${response.status}`,
      message: `${channel} publish failed (${response.status})`,
      retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
      provider: channel,
      details: { sanitizedBody }
    });
  }
  return response;
}
