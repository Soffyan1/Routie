import { afterEach, describe, expect, it, vi } from "vitest";
import { isZarkPilotEnabled, ProviderRequestError, ZarkAdapter, zarkPilotMonthlyImageLimit } from "../src";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Zark image pilot", () => {
  it("can only be enabled outside production and normalizes the monthly cap", () => {
    expect(isZarkPilotEnabled({ NODE_ENV: "development", ENABLE_ZARK_PROVIDER: "true" })).toBe(true);
    expect(isZarkPilotEnabled({ NODE_ENV: "production", ENABLE_ZARK_PROVIDER: "true" })).toBe(false);
    expect(zarkPilotMonthlyImageLimit({ ZARK_PILOT_MONTHLY_IMAGE_LIMIT: "40" })).toBe(40);
    expect(zarkPilotMonthlyImageLimit({ ZARK_PILOT_MONTHLY_IMAGE_LIMIT: "9999" })).toBe(500);
    expect(zarkPilotMonthlyImageLimit({ ZARK_PILOT_MONTHLY_IMAGE_LIMIT: "invalid" })).toBe(25);
  });

  it("validates an API key without starting a paid generation", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ name: "zark-mcp", tools: ["zark_ai", "get_file"] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ZarkAdapter().validateCredential("zark-secret-key")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.zarklab.ai/v1/mcp");
  });

  it("uses Zark MCP v2, retrieves the signed image, and records credits", async () => {
    const encoder = new TextEncoder();

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/mcp")) {
        const body = JSON.parse(String(init?.body)) as { params: { name: string } };
        if (body.params.name === "zark_ai") {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            result: {
              structuredContent: {
                success: true,
                run_id: "run-image-1",
                response: "Gambar siap",
                generated_file_ids: ["file-image-1"],
                media_items: [{ file_id: "file-image-1", media_type: "image" }],
                usage: { credits_used: 18 }
              }
            }
          });
        }
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            structuredContent: {
              success: true,
              file: {
                file_id: "file-image-1",
                content_type: "image/png",
                download_url: "https://storage.example.test/file-image-1.png"
              }
            }
          }
        });
      }
      if (url === "https://storage.example.test/file-image-1.png") {
        return new Response(encoder.encode("fake-png"), { status: 200, headers: { "content-type": "image/png" } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ZarkAdapter().generate("zark-secret-key", {
      capability: "IMAGE",
      model: "auto",
      prompt: "Buat visual produk minimalis",
      aspectRatio: "4:5",
      idempotencyKey: "concept-media:test:v1"
    });

    expect(result).toMatchObject({
      status: "COMPLETED",
      providerJobId: "run-image-1",
      text: "Gambar siap",
      usage: { images: 1, credits: 18 }
    });
    expect(result.assetUrls?.[0]).toBe(`data:image/png;base64,${Buffer.from("fake-png").toString("base64")}`);

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "zark_ai",
        arguments: {
          wait: true,
          fileIds: [],
          prompt: expect.stringContaining("Create exactly one 4:5 social-media image")
        }
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toBeUndefined();
  });

  it("accepts a text-encoded MCP tool result", async () => {
    const encoder = new TextEncoder();

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/mcp")) {
        const body = JSON.parse(String(init?.body)) as { params: { name: string } };
        if (body.params.name === "zark_ai") {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    run_id: "run-image-2",
                    generated_file_ids: ["file-image-2"],
                    media_items: []
                  })
                }
              ]
            }
          });
        }
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  file: {
                    file_id: "file-image-2",
                    content_type: "image/webp",
                    download_url: "https://storage.example.test/file-image-2.webp"
                  }
                })
              }
            ]
          }
        });
      }
      if (url === "https://storage.example.test/file-image-2.webp") {
        return new Response(encoder.encode("fake-webp"), {
          status: 200,
          headers: { "content-type": "image/webp" }
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ZarkAdapter().generate("zark-secret-key", {
        capability: "IMAGE",
        model: "auto",
        prompt: "Buat gambar",
        idempotencyKey: "media-item-event"
      })
    ).resolves.toMatchObject({
      providerJobId: "run-image-2",
      status: "COMPLETED",
      usage: { images: 1 }
    });
  });

  it("does not retry an insufficient-credit response", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: "Insufficient credits", code: "insufficient_credits" }, { status: 402 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const generation = new ZarkAdapter().generate("zark-secret-key", {
      capability: "IMAGE",
      model: "auto",
      prompt: "test",
      idempotencyKey: "test-credit-limit"
    });

    await expect(generation).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(generation).rejects.toMatchObject({
      normalized: { code: "insufficient_credits", retryable: false, provider: "ZARK" }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks a pre-stream server failure as safely retryable without exposing the raw response", async () => {
    const fetchMock = vi.fn(async () => Response.json({ message: "Internal server error" }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const generation = new ZarkAdapter().generate("zark-secret-key", {
      capability: "IMAGE",
      model: "auto",
      prompt: "Buat visual sosial media",
      idempotencyKey: "zark-server-error"
    });

    await expect(generation).rejects.toMatchObject({
      message: "Layanan gambar Zark sedang mengalami gangguan. Routie akan mencoba sekali lagi secara aman.",
      normalized: {
        code: "HTTP_500",
        retryable: true,
        provider: "ZARK",
        details: { httpStatus: 500 }
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
