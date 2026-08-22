import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exchangeMetaAuthorizationCode,
  listMetaPages,
  openMetaSelection,
  sealMetaSelection
} from "../lib/meta-oauth";

afterEach(() => vi.unstubAllGlobals());

describe("Meta OAuth helpers", () => {
  it("exchanges the callback code and discovers publishable Pages", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/oauth/access_token") && url.searchParams.has("code")) {
        return Response.json({ access_token: "short-token" });
      }
      if (url.pathname.endsWith("/oauth/access_token")) {
        return Response.json({ access_token: "long-token", expires_in: 5_184_000 });
      }
      return Response.json({
        data: [
          {
            id: "page-1",
            name: "Routie Test Page",
            access_token: "page-token",
            tasks: ["CREATE_CONTENT"],
            instagram_business_account: { id: "ig-1" }
          }
        ]
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await exchangeMetaAuthorizationCode({
      code: "callback-code",
      redirectUri: "https://app.example.test/api/auth/callback/meta",
      appId: "app-id",
      appSecret: "app-secret",
      version: "v24.0"
    });
    const pages = await listMetaPages(token.accessToken, "v24.0");
    expect(token.accessToken).toBe("long-token");
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: "page-1", instagram_business_account: { id: "ig-1" } });
  });

  it("encrypts a short-lived account-selection session", () => {
    const masterKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
    const selection = {
      actorId: "00000000-0000-4000-8000-000000000001",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      intent: "INSTAGRAM" as const,
      accessToken: "private-meta-token",
      tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    };
    const sealed = sealMetaSelection(selection, masterKey);
    expect(sealed).not.toContain(selection.accessToken);
    expect(openMetaSelection(sealed, masterKey)).toEqual(selection);
  });
});
