import { afterEach, describe, expect, it, vi } from "vitest";
import { TikTokPublisher } from "../src";

const flags = { meta: false, tiktok: false, tiktokDraft: true, threads: false, youtube: false };
const request = {
  connectionId: "connection-id",
  channel: "TIKTOK" as const,
  externalAccountId: "open-id",
  deliveryMode: "PLATFORM_DRAFT" as const,
  caption: "A short video",
  mediaUrls: ["https://media.routie.test/workspace/video.mp4"],
  contentKind: "SHORT_VIDEO" as const,
  scheduledFor: new Date("2026-08-21T10:00:00.000Z"),
  idempotencyKey: "idempotency-key"
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TIKTOK_MEDIA_URL_PREFIX;
});

describe("TikTok draft publisher", () => {
  it("sends a verified video URL to TikTok's inbox upload endpoint", async () => {
    process.env.TIKTOK_MEDIA_URL_PREFIX = "https://media.routie.test";
    const fetchMock = vi.fn(async () => Response.json({ data: { publish_id: "v_inbox_url~v2.123" }, error: { code: "ok" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new TikTokPublisher(flags).publish("access-token", request);
    expect(result).toMatchObject({ status: "PROCESSING", providerJobId: "v_inbox_url~v2.123" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/post/publish/inbox/video/init/");
  });

  it("does not allow scheduled direct posts to bypass TikTok consent", () => {
    expect(() => new TikTokPublisher({ ...flags, tiktok: true }).validate({ ...request, deliveryMode: "AUTO_PUBLISH" })).toThrow(
      "TikTok meminta konfirmasi pengguna"
    );
  });

  it("sends photos to TikTok's draft editing flow", async () => {
    process.env.TIKTOK_MEDIA_URL_PREFIX = "https://media.routie.test";
    const fetchMock = vi.fn(async () => Response.json({ data: { publish_id: "p_pub_url~v2.123" }, error: { code: "ok" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new TikTokPublisher(flags).publish("access-token", {
        ...request,
        contentKind: "IMAGE",
        mediaUrls: ["https://media.routie.test/workspace/image.jpg"]
      })
    ).resolves.toMatchObject({ status: "PROCESSING", providerJobId: "p_pub_url~v2.123" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/post/publish/content/init/");
  });
});
