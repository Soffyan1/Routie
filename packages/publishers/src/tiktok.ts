import type { PublishRequest, PublishResult, SocialPublisherAdapter } from "@routie/domain";
import { PublishRequestError, publishFetch, validateAgainstCapability } from "./base";
import { capabilityFor, type ChannelFeatureFlags } from "./capabilities";

export class TikTokPublisher implements SocialPublisherAdapter {
  readonly channel = "TIKTOK" as const;
  constructor(private readonly flags: ChannelFeatureFlags) {}

  getCapability() {
    return capabilityFor(this.channel, this.flags);
  }

  validate(request: PublishRequest): void {
    validateAgainstCapability(request, this.getCapability());
    if (this.getCapability().deliveryMode !== "AUTO_PUBLISH") throw new Error("TikTok Direct Post is disabled until app review completes");
    if (request.contentKind !== "SHORT_VIDEO") throw new Error("TikTok image posts use platform draft/export in Routie v1");
  }

  async publish(accessToken: string | null, request: PublishRequest): Promise<PublishResult> {
    this.validate(request);
    if (!accessToken) throw new Error("TikTok access token is required");
    const response = await publishFetch(this.channel, "https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        post_info: { title: request.caption.slice(0, 2200), privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false },
        source_info: { source: "PULL_FROM_URL", video_url: request.mediaUrls[0] }
      })
    });
    const payload = (await response.json()) as { data?: { publish_id?: string } };
    if (!payload.data?.publish_id) throw new Error("TikTok returned no publish ID");
    return { status: "PROCESSING", providerJobId: payload.data.publish_id };
  }

  async reconcile(accessToken: string, providerJobId: string): Promise<PublishResult> {
    const response = await publishFetch(this.channel, "https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: providerJobId })
    });
    const payload = await response.json() as { data?: { status?: string; publicaly_available_post_id?: string[]; fail_reason?: string } };
    const status = payload.data?.status;
    if (status === "PUBLISH_COMPLETE") {
      const externalPostId = payload.data?.publicaly_available_post_id?.[0];
      return { status: "PUBLISHED", ...(externalPostId ? { externalPostId } : {}), providerJobId };
    }
    if (status === "FAILED") throw new PublishRequestError({ code: "TIKTOK_PUBLISH_FAILED", message: payload.data?.fail_reason ?? "TikTok publish failed", retryable: false, provider: this.channel });
    return { status: "PROCESSING", providerJobId };
  }
}
