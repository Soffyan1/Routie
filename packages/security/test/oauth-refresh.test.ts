import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshThreadsAccessToken, refreshTikTokAccessToken } from "../src";

afterEach(() => vi.unstubAllGlobals());

describe("Threads token refresh", () => {
  it("refreshes a long-lived token without exposing it in the request body", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      Response.json({ access_token: "threads-new-token", expires_in: 5_184_000 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await refreshThreadsAccessToken("threads-old-token");
    expect(result.accessToken).toBe("threads-new-token");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/refresh_access_token");
    expect(url.searchParams.get("grant_type")).toBe("th_refresh_token");
  });

  it("marks revoked authorization as permanent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: 190, message: "Invalid token" } }, { status: 400 })));
    await expect(refreshThreadsAccessToken("revoked")).rejects.toMatchObject({
      code: "THREADS_190",
      permanent: true
    });
  });
});

describe("TikTok token refresh", () => {
  it("rotates and returns the newest refresh token", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ access_token: "tiktok-new-access", refresh_token: "tiktok-new-refresh", expires_in: 86_400, refresh_expires_in: 31536000 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await refreshTikTokAccessToken("tiktok-old-refresh", "client-key", "client-secret");
    expect(result.accessToken).toBe("tiktok-new-access");
    expect(result.refreshToken).toBe("tiktok-new-refresh");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("marks a revoked TikTok refresh token as permanent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "invalid_grant" } }, { status: 400 })));
    await expect(refreshTikTokAccessToken("revoked", "client-key", "client-secret")).rejects.toMatchObject({
      code: "invalid_grant",
      permanent: true
    });
  });
});
