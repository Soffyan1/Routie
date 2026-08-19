export interface TextChunk {
  index: number;
  text: string;
  start: number;
  end: number;
}

export function chunkText(input: string, maxCharacters = 1_600, overlap = 200): TextChunk[] {
  const normalized = input.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxCharacters);
    if (end < normalized.length) {
      const paragraph = normalized.lastIndexOf("\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      const boundary = Math.max(paragraph, sentence);
      if (boundary > start + maxCharacters / 2) end = boundary + 1;
    }
    chunks.push({ index: chunks.length, text: normalized.slice(start, end).trim(), start, end });
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}
