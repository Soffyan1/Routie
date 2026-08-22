import { describe, expect, it } from "vitest";
import { createOAuthStateToken, verifyOAuthStateToken } from "../src";

const secret = "test-session-secret-that-is-long-enough-for-hs256";

describe("social OAuth state", () => {
  it("binds the provider callback to an actor and workspace", async () => {
    const claims = {
      sub: "00000000-0000-4000-8000-000000000001",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      provider: "META" as const,
      intent: "INSTAGRAM" as const,
      redirectUri: "https://app.example.test/api/auth/callback/meta"
    };
    const token = await createOAuthStateToken(claims, secret);
    await expect(verifyOAuthStateToken(token, secret)).resolves.toEqual(claims);
  });

  it("rejects a state signed with a different secret", async () => {
    const token = await createOAuthStateToken(
      {
        sub: "00000000-0000-4000-8000-000000000001",
        workspaceId: "00000000-0000-4000-8000-000000000002",
        provider: "THREADS",
        intent: "THREADS",
        redirectUri: "https://app.example.test/api/auth/callback/threads"
      },
      secret
    );
    await expect(verifyOAuthStateToken(token, `${secret}-different`)).rejects.toThrow();
  });

  it("supports a TikTok state bound to the original user and workspace", async () => {
    const claims = {
      sub: "00000000-0000-4000-8000-000000000001",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      provider: "TIKTOK" as const,
      intent: "TIKTOK" as const,
      redirectUri: "https://app.example.test/api/auth/callback/tiktok"
    };
    const token = await createOAuthStateToken(claims, secret);
    await expect(verifyOAuthStateToken(token, secret)).resolves.toEqual(claims);
  });
});
