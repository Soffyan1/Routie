import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderRequestError, providerFetch } from "../src/base";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("providerFetch", () => {
  it("uses the queue as the only retry layer for rate limits", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message: "Quota exceeded"
          }
        },
        { status: 429, headers: { "retry-after": "30" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = providerFetch("GEMINI", "https://provider.example.test/generate", { method: "POST" });

    await expect(request).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(request).rejects.toMatchObject({
      message: "Layanan AI sedang membatasi permintaan. Routie akan memberi jeda sebelum mencoba kembali.",
      normalized: {
        code: "RESOURCE_EXHAUSTED",
        retryable: true,
        retryAfterMs: 30_000,
        details: { httpStatus: 429 }
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps non-retryable provider errors descriptive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { status: "INVALID_ARGUMENT", message: "Unsupported model" } }, { status: 400 }))
    );

    await expect(providerFetch("GEMINI", "https://provider.example.test/generate", {})).rejects.toMatchObject({
      message: "Unsupported model",
      normalized: { code: "INVALID_ARGUMENT", retryable: false }
    });
  });
});
