import { describe, expect, it } from "vitest";
import { buildProductPosterPrompt, getCreativeRecipe } from "../src/creative-recipes";

describe("product poster recipes", () => {
  it("uses a safe fallback recipe and keeps deterministic overlay constraints", () => {
    const prompt = buildProductPosterPrompt({
      businessName: "Toko Sinar", productName: "Paket Data 30GB", recipeCode: "unknown", aspectRatio: "4:5",
      headline: "Hemat minggu ini", offerText: "Rp50.000", colors: ["#4F46E5"]
    });
    expect(getCreativeRecipe("unknown").code).toBe("minimal-product");
    expect(prompt).toContain("Paket Data 30GB");
    expect(prompt).toContain("Output aspect ratio: 4:5");
    expect(prompt).toContain("Do not add readable text");
    expect(prompt).toContain("preserve the exact product identity");
  });
});
