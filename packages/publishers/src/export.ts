import type { PublishRequest, PublishResult, SocialPublisherAdapter } from "@routie/domain";
import { capabilityFor, type ChannelFeatureFlags } from "./capabilities";
import { validateAgainstCapability } from "./base";

export class ExportPublisher implements SocialPublisherAdapter {
  constructor(readonly channel: PublishRequest["channel"], private readonly flags: ChannelFeatureFlags) {}

  getCapability() {
    const capability = capabilityFor(this.channel, this.flags);
    return { ...capability, deliveryMode: this.channel === "TIKTOK" ? "PLATFORM_DRAFT" as const : "EXPORT_MANUAL" as const };
  }

  validate(request: PublishRequest): void {
    validateAgainstCapability(request, this.getCapability());
  }

  async publish(_accessToken: string | null, request: PublishRequest): Promise<PublishResult> {
    this.validate(request);
    const payload = Buffer.from(
      JSON.stringify({ channel: request.channel, caption: request.caption, mediaUrls: request.mediaUrls, scheduledFor: request.scheduledFor.toISOString() })
    ).toString("base64url");
    return { status: "EXPORTED", externalUrl: `data:application/json;base64,${payload}` };
  }
}
