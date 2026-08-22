import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaPublisher } from "../src";

const flags = { meta: true, threads: true, tiktok: false, youtube: false };
const baseRequest = {
  connectionId: "connection-1",
  externalAccountId: "account-1",
  caption: "Konten Routie",
  mediaUrls: ["https://cdn.example.test/image.png"],
  contentKind: "IMAGE" as const,
  scheduledFor: new Date("2026-08-21T10:00:00.000Z"),
  idempotencyKey: "publish-1"
};

afterEach(() => vi.unstubAllGlobals());

describe("Meta publishers", () => {
  it("uses the Facebook Graph host for Instagram with Facebook Login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MetaPublisher("INSTAGRAM", flags).publish("page-token", {
      ...baseRequest,
      channel: "INSTAGRAM"
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://graph.facebook.com/v24.0/account-1/media");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://graph.facebook.com/v24.0/account-1/media_publish");
    expect(result).toMatchObject({ status: "PUBLISHED", externalPostId: "media-1" });
  });

  it("publishes a Threads text post without requiring media", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "container-2" }))
      .mockResolvedValueOnce(Response.json({ id: "thread-2" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new MetaPublisher("THREADS", flags).publish("threads-token", {
        ...baseRequest,
        channel: "THREADS",
        contentKind: "TEXT",
        mediaUrls: []
      })
    ).resolves.toMatchObject({ status: "PUBLISHED", externalPostId: "thread-2" });
  });
});
