import { describe, expect, it } from "vitest";
import { ProviderRequestError } from "@routie/providers";
import { friendlyGenerationFailure } from "../src/generate";

describe("friendlyGenerationFailure", () => {
  it("turns provider rate limits into an actionable user message", () => {
    const message = friendlyGenerationFailure(
      new ProviderRequestError({
        code: "RESOURCE_EXHAUSTED",
        message: "Layanan AI sedang membatasi permintaan.",
        retryable: true,
        provider: "GEMINI",
        details: { httpStatus: 429 }
      })
    );

    expect(message).toContain("kuotanya sedang penuh");
    expect(message).toContain("Coba lagi beberapa menit lagi");
    expect(message).not.toContain("429");
  });

  it("does not expose a provider's raw internal-server response", () => {
    const message = friendlyGenerationFailure(
      new ProviderRequestError({
        code: "HTTP_500",
        message: 'Internal server error: {"message":"Internal server error"}',
        retryable: true,
        provider: "ZARK",
        details: { httpStatus: 500 }
      })
    );

    expect(message).toContain("gangguan sementara");
    expect(message).not.toContain("Internal server error");
    expect(message).not.toContain("{");
  });
});
