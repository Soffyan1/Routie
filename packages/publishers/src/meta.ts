import type { PublishRequest, PublishResult, SocialPublisherAdapter } from "@routie/domain";
import { publishFetch, validateAgainstCapability } from "./base";
import { capabilityFor, type ChannelFeatureFlags } from "./capabilities";

type MetaResponse = { id?: string; post_id?: string };

export class MetaPublisher implements SocialPublisherAdapter {
  constructor(readonly channel: "FACEBOOK" | "INSTAGRAM" | "THREADS", private readonly flags: ChannelFeatureFlags) {}

  getCapability() {
    return capabilityFor(this.channel, this.flags);
  }

  validate(request: PublishRequest): void {
    validateAgainstCapability(request, this.getCapability());
    if (this.getCapability().deliveryMode !== "AUTO_PUBLISH") throw new Error(`${this.channel} auto-publish is disabled until app review completes`);
  }

  async publish(accessToken: string | null, request: PublishRequest): Promise<PublishResult> {
    this.validate(request);
    if (!accessToken) throw new Error(`${this.channel} access token is required`);
    if (this.channel === "FACEBOOK") return this.publishFacebook(accessToken, request);
    if (this.channel === "INSTAGRAM") return this.publishInstagram(accessToken, request);
    return this.publishThreads(accessToken, request);
  }

  private async publishFacebook(token: string, request: PublishRequest): Promise<PublishResult> {
    const endpoint = request.contentKind === "IMAGE" ? "photos" : "feed";
    const body = new URLSearchParams({ access_token: token, message: request.caption });
    if (request.mediaUrls[0]) body.set(request.contentKind === "IMAGE" ? "url" : "link", request.mediaUrls[0]);
    const response = await publishFetch(this.channel, `https://graph.facebook.com/v24.0/${request.externalAccountId}/${endpoint}`, { method: "POST", body });
    const payload = (await response.json()) as MetaResponse;
    const id = payload.post_id ?? payload.id;
    if (!id) throw new Error("Facebook returned no post ID");
    return { status: "PUBLISHED", externalPostId: id, externalUrl: `https://facebook.com/${id}` };
  }

  private async publishInstagram(token: string, request: PublishRequest): Promise<PublishResult> {
    const mediaType = request.contentKind === "SHORT_VIDEO" ? "REELS" : request.contentKind === "STORY" ? "STORIES" : "IMAGE";
    const body = new URLSearchParams({ access_token: token, caption: request.caption, media_type: mediaType });
    const asset = request.mediaUrls[0]!;
    body.set(mediaType === "REELS" || mediaType === "STORIES" && asset.includes("video") ? "video_url" : "image_url", asset);
    const containerResponse = await publishFetch(this.channel, `https://graph.instagram.com/v24.0/${request.externalAccountId}/media`, { method: "POST", body });
    const container = (await containerResponse.json()) as MetaResponse;
    if (!container.id) throw new Error("Instagram returned no media container ID");
    const publishBody = new URLSearchParams({ access_token: token, creation_id: container.id });
    const response = await publishFetch(this.channel, `https://graph.instagram.com/v24.0/${request.externalAccountId}/media_publish`, { method: "POST", body: publishBody });
    const payload = (await response.json()) as MetaResponse;
    if (!payload.id) throw new Error("Instagram returned no media ID");
    return { status: "PUBLISHED", externalPostId: payload.id, externalUrl: `https://instagram.com/p/${payload.id}` };
  }

  private async publishThreads(token: string, request: PublishRequest): Promise<PublishResult> {
    const mediaType = request.contentKind === "TEXT" ? "TEXT" : request.contentKind === "SHORT_VIDEO" ? "VIDEO" : "IMAGE";
    const body = new URLSearchParams({ access_token: token, media_type: mediaType, text: request.caption });
    if (request.mediaUrls[0]) body.set(mediaType === "VIDEO" ? "video_url" : "image_url", request.mediaUrls[0]);
    const containerResponse = await publishFetch(this.channel, `https://graph.threads.net/v1.0/${request.externalAccountId}/threads`, { method: "POST", body });
    const container = (await containerResponse.json()) as MetaResponse;
    if (!container.id) throw new Error("Threads returned no container ID");
    const response = await publishFetch(this.channel, `https://graph.threads.net/v1.0/${request.externalAccountId}/threads_publish`, {
      method: "POST",
      body: new URLSearchParams({ access_token: token, creation_id: container.id })
    });
    const payload = (await response.json()) as MetaResponse;
    if (!payload.id) throw new Error("Threads returned no post ID");
    return { status: "PUBLISHED", externalPostId: payload.id, externalUrl: `https://threads.net/post/${payload.id}` };
  }
}
