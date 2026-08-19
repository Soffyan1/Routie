import { describe, expect, it } from "vitest";
import { chunkText, embedText } from "../src";

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

describe("local knowledge retrieval", () => {
  it("creates normalized compatible query and passage vectors", async () => {
    const passage = await embedText("Kopi lokal tanpa gula untuk pekerja kreatif", "passage");
    const query = await embedText("kopi lokal tanpa gula", "query");
    expect(passage).toHaveLength(384);
    expect(Math.sqrt(passage.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 6);
    expect(dot(passage, query)).toBeGreaterThan(0.4);
  });

  it("chunks large documents with bounded overlap", () => {
    const chunks = chunkText("Kalimat satu. ".repeat(400), 500, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 500)).toBe(true);
    expect(chunks[1]!.start).toBeLessThan(chunks[0]!.end);
  });
});
