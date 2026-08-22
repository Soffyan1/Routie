import type { PublishRequest, PublishResult, SocialPublisherAdapter } from "@routie/domain";
import { PublishRequestError, publishFetch, validateAgainstCapability } from "./base";
import { capabilityFor, type ChannelFeatureFlags } from "./capabilities";

type TikTokApiResponse = {
  data?: {
    publish_id?: string;
    status?: string;
    publicaly_available_post_id?: Array<string | number>;
    fail_reason?: string;
  };
  error?: { code?: string | number; message?: string; log_id?: string };
};

function hasTikTokError(payload: TikTokApiResponse): boolean {
  const code = payload.error?.code;
  return code !== undefined && code !== "ok" && code !== "0" && code !== 0;
}

function tiktokFailure(payload: TikTokApiResponse, fallback: string): PublishRequestError {
  const rawCode = String(payload.error?.code ?? "unknown").toUpperCase();
  const retryable = ["INTERNAL_ERROR", "RATE_LIMIT_EXCEEDED", "VIDEO_PULL_FAILED"].includes(rawCode);
  return new PublishRequestError({
    code: `TIKTOK_${rawCode}`,
    message: payload.error?.message || fallback,
    retryable,
    provider: "TIKTOK",
    ...(payload.error?.log_id ? { details: { logId: payload.error.log_id } } : {})
  });
}

function verifiedMediaUrl(mediaUrl: string | undefined): string {
  const prefix = process.env.TIKTOK_MEDIA_URL_PREFIX?.replace(/\/$/, "");
  if (!prefix) {
    throw new PublishRequestError({
      code: "TIKTOK_MEDIA_URL_NOT_CONFIGURED",
      message: "Sinkronisasi draft TikTok belum siap di server Routie.",
      retryable: false,
      provider: "TIKTOK"
    });
  }
  if (!mediaUrl || (!mediaUrl.startsWith(`${prefix}/`) && mediaUrl !== prefix)) {
    throw new PublishRequestError({
      code: "TIKTOK_MEDIA_URL_UNVERIFIED",
      message: "Video belum tersedia dari alamat media Routie yang terverifikasi untuk TikTok.",
      retryable: false,
      provider: "TIKTOK"
    });
  }
  return mediaUrl;
}

function verifiedMediaUrls(mediaUrls: string[]): string[] {
  if (mediaUrls.length === 0 || mediaUrls.length > 35) {
    throw new PublishRequestError({
      code: "TIKTOK_PHOTO_COUNT_INVALID",
      message: "TikTok menerima antara 1 sampai 35 foto dalam satu draft.",
      retryable: false,
      provider: "TIKTOK"
    });
  }
  return mediaUrls.map(verifiedMediaUrl);
}

export class TikTokPublisher implements SocialPublisherAdapter {
  readonly channel = "TIKTOK" as const;
  constructor(private readonly flags: ChannelFeatureFlags) {}

  getCapability() {
    return capabilityFor(this.channel, this.flags);
  }

  validate(request: PublishRequest): void {
    validateAgainstCapability(request, this.getCapability());
    if (request.contentKind !== "SHORT_VIDEO" && request.contentKind !== "IMAGE") {
      throw new Error("TikTok Routie saat ini mendukung foto dan video pendek.");
    }
    if (request.deliveryMode === "PLATFORM_DRAFT" && !this.flags.tiktokDraft) {
      throw new Error("Sinkronisasi draft TikTok belum diaktifkan oleh administrator Routie.");
    }
    if (request.deliveryMode === "AUTO_PUBLISH") {
      // Direct Post requires explicit, per-post user consent and settings.
      // A scheduled job must never bypass TikTok's required interaction.
      throw new PublishRequestError({
        code: "TIKTOK_USER_CONSENT_REQUIRED",
        message: "TikTok meminta konfirmasi pengguna sebelum posting langsung. Gunakan mode draft untuk konten terjadwal.",
        retryable: false,
        provider: this.channel
      });
    }
  }

  async publish(accessToken: string | null, request: PublishRequest): Promise<PublishResult> {
    this.validate(request);
    if (!accessToken) throw new Error("TikTok access token is required");
    if (request.contentKind === "IMAGE") return this.publishPhotos(accessToken, request);
    const response = await publishFetch(this.channel, "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        source_info: { source: "PULL_FROM_URL", video_url: verifiedMediaUrl(request.mediaUrls[0]) }
      })
    });
    const payload = (await response.json()) as TikTokApiResponse;
    if (hasTikTokError(payload) || !payload.data?.publish_id) {
      throw tiktokFailure(payload, "TikTok belum dapat menerima video untuk draft.");
    }
    return { status: "PROCESSING", providerJobId: payload.data.publish_id };
  }

  private async publishPhotos(accessToken: string, request: PublishRequest): Promise<PublishResult> {
    const response = await publishFetch(this.channel, "https://open.tiktokapis.com/v2/post/publish/content/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        post_info: {
          title: request.caption.slice(0, 90),
          description: request.caption.slice(0, 4000)
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: verifiedMediaUrls(request.mediaUrls)
        },
        post_mode: "MEDIA_UPLOAD",
        media_type: "PHOTO"
      })
    });
    const payload = (await response.json()) as TikTokApiResponse;
    if (hasTikTokError(payload) || !payload.data?.publish_id) {
      throw tiktokFailure(payload, "TikTok belum dapat menerima foto untuk draft.");
    }
    return { status: "PROCESSING", providerJobId: payload.data.publish_id };
  }

  async reconcile(accessToken: string, providerJobId: string): Promise<PublishResult> {
    const response = await publishFetch(this.channel, "https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: providerJobId })
    });
    const payload = (await response.json()) as TikTokApiResponse;
    if (hasTikTokError(payload)) throw tiktokFailure(payload, "TikTok belum dapat memeriksa status draft.");
    const status = payload.data?.status;
    if (status === "SEND_TO_USER_INBOX") {
      return { status: "PUBLISHED", providerJobId, externalUrl: "https://www.tiktok.com/inbox" };
    }
    if (status === "PUBLISH_COMPLETE") {
      const externalPostId = payload.data?.publicaly_available_post_id?.[0];
      return { status: "PUBLISHED", providerJobId, ...(externalPostId ? { externalPostId: String(externalPostId) } : {}) };
    }
    if (status === "FAILED") {
      const retryable = ["internal", "video_pull_failed"].includes(payload.data?.fail_reason ?? "");
      throw new PublishRequestError({
        code: "TIKTOK_PUBLISH_FAILED",
        message: payload.data?.fail_reason || "TikTok gagal memproses video.",
        retryable,
        provider: this.channel
      });
    }
    return { status: "PROCESSING", providerJobId };
  }
}
