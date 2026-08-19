import { createHash } from "node:crypto";

const DIMENSIONS = 384;

function indexAndSign(token: string): [number, number] {
  const digest = createHash("sha256").update(token).digest();
  const index = digest.readUInt32BE(0) % DIMENSIONS;
  const sign = digest[4]! % 2 === 0 ? 1 : -1;
  return [index, sign];
}

/**
 * Dependency-free multilingual feature hashing for local pgvector retrieval.
 * Word and character n-grams preserve useful similarity across Indonesian,
 * English, and mixed brand copy without sending source documents externally.
 */
export async function embedText(text: string, _mode: "query" | "passage" = "passage"): Promise<number[]> {
  const normalized = text.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  const features = new Map<string, number>();
  for (const word of words) {
    features.set(`w:${word}`, (features.get(`w:${word}`) ?? 0) + 2);
    const padded = `^${word}$`;
    for (let size = 3; size <= 5; size += 1) {
      for (let start = 0; start + size <= padded.length; start += 1) {
        const feature = `c${size}:${padded.slice(start, start + size)}`;
        features.set(feature, (features.get(feature) ?? 0) + 1);
      }
    }
  }
  for (let index = 0; index + 1 < words.length; index += 1) {
    const feature = `b:${words[index]}_${words[index + 1]}`;
    features.set(feature, (features.get(feature) ?? 0) + 2);
  }
  const vector = Array<number>(DIMENSIONS).fill(0);
  for (const [feature, weight] of features) {
    const [index, sign] = indexAndSign(feature);
    vector[index] = (vector[index] ?? 0) + sign * Math.log1p(weight);
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}
