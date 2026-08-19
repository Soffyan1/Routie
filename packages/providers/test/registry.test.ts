import { describe, expect, it } from "vitest";
import { getProviderAdapter, modelsForCapability } from "../src";

describe("AI capability registry", () => {
  it("does not expose Anthropic as a media generator", () => {
    expect(modelsForCapability("IMAGE").some((model) => model.provider === "ANTHROPIC")).toBe(false);
    expect(modelsForCapability("VIDEO").map((model) => model.provider)).toEqual(["GEMINI"]);
  });

  it("rejects model/capability combinations outside the allowlist before network use", async () => {
    await expect(getProviderAdapter("OPENAI").generate("secret", {
      capability: "VIDEO",
      model: "gpt-image-2",
      prompt: "test",
      system: "test",
      idempotencyKey: "test-1"
    })).rejects.toThrow(/does not support VIDEO/);
  });
});
