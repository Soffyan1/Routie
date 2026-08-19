import type { PublishRequest, PublishResult, SocialPublisherAdapter } from "@routie/domain";
import { publishFetch, validateAgainstCapability } from "./base";
import { capabilityFor, type ChannelFeatureFlags } from "./capabilities";

export class YouTubePublisher implements SocialPublisherAdapter {
  readonly channel = "YOUTUBE" as const;
  constructor(private readonly flags: ChannelFeatureFlags) {}

  getCapability() {
    return capabilityFor(this.channel, this.flags);
  }

  validate(request: PublishRequest): void {
    validateAgainstCapability(request, this.getCapability());
    if (this.getCapability().deliveryMode !== "AUTO_PUBLISH") throw new Error("YouTube publishing is disabled until API audit completes");
  }

  async publish(accessToken: string | null, request: PublishRequest): Promise<PublishResult> {
    this.validate(request);
    if (!accessToken) throw new Error("YouTube access token is required");
    const mediaResponse = await publishFetch(this.channel, request.mediaUrls[0]!, {});
    const bytes = await mediaResponse.arrayBuffer();
    const init = await publishFetch(this.channel, "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.byteLength),
        "X-Upload-Content-Type": "video/mp4"
      },
      body: JSON.stringify({
        snippet: { title: request.caption.slice(0, 100) || "Routie Short", description: request.caption },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: true }
      })
    });
    const uploadUrl = init.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube returned no resumable upload URL");
    const uploaded = await publishFetch(this.channel, uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: bytes });
    const payload = (await uploaded.json()) as { id?: string };
    if (!payload.id) throw new Error("YouTube returned no video ID");
    return { status: "PUBLISHED", externalPostId: payload.id, externalUrl: `https://youtube.com/shorts/${payload.id}` };
  }
}
