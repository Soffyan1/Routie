import type { AIProviderAdapter, GenerateRequest, GenerateResult, ProviderModel, ResearchSource } from "@routie/domain";
import { assertCapability, providerFetch, toDataUrl } from "./base";

const models = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", capabilities: ["TEXT", "WEB_SEARCH"], lifecycle: "STABLE" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", capabilities: ["TEXT", "WEB_SEARCH"], lifecycle: "STABLE" },
  { id: "gpt-image-2", label: "GPT Image 2", capabilities: ["IMAGE"], lifecycle: "STABLE" },
  { id: "tts-1", label: "TTS 1", capabilities: ["TTS"], lifecycle: "STABLE" }
] as const satisfies readonly ProviderModel[];

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function extractResponseText(payload: OpenAIResponse): string {
  if (payload.output_text) return payload.output_text;
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("\n");
}

function extractSources(payload: OpenAIResponse): ResearchSource[] {
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const annotation of (payload.output ?? []).flatMap((item) => item.content ?? []).flatMap((item) => item.annotations ?? [])) {
    if (annotation.type !== "url_citation" || !annotation.url || seen.has(annotation.url)) continue;
    seen.add(annotation.url);
    sources.push({ url: annotation.url, title: annotation.title ?? annotation.url, accessedAt: new Date() });
  }
  return sources;
}

export class OpenAIAdapter implements AIProviderAdapter {
  readonly provider = "OPENAI" as const;

  listModels() {
    return models;
  }

  async validateCredential(apiKey: string): Promise<boolean> {
    try {
      await providerFetch(this.provider, "https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
      return true;
    } catch {
      return false;
    }
  }

  async generate(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    assertCapability(models, request.model, request.capability);
    if (request.capability === "IMAGE") return this.generateImage(apiKey, request);
    if (request.capability === "TTS") return this.generateSpeech(apiKey, request);

    const response = await providerFetch(this.provider, "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({
        model: request.model,
        instructions: request.system,
        input: request.prompt,
        ...(request.capability === "WEB_SEARCH" ? { tools: [{ type: "web_search" }] } : {})
      })
    });
    const payload = (await response.json()) as OpenAIResponse;
    const usage = {
      ...(payload.usage?.input_tokens !== undefined ? { inputTokens: payload.usage.input_tokens } : {}),
      ...(payload.usage?.output_tokens !== undefined ? { outputTokens: payload.usage.output_tokens } : {})
    };
    return {
      status: "COMPLETED",
      text: extractResponseText(payload),
      sources: extractSources(payload),
      usage
    };
  }

  private async generateImage(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    const size = request.aspectRatio === "9:16" || request.aspectRatio === "4:5" ? "1024x1536" : request.aspectRatio === "16:9" ? "1536x1024" : "1024x1024";
    if (request.inputAssetUrls?.length) return this.editImage(apiKey, request, size);
    const response = await providerFetch(this.provider, "https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({ model: request.model, prompt: request.prompt, size, quality: "medium", output_format: "png" })
    });
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const asset = payload.data?.[0];
    if (!asset) throw new Error("OpenAI returned no generated image");
    return { status: "COMPLETED", assetUrls: [asset.url ?? toDataUrl("image/png", asset.b64_json ?? "")], usage: { images: 1 } };
  }

  private async editImage(apiKey: string, request: GenerateRequest, size: string): Promise<GenerateResult> {
    const form = new FormData();
    form.set("model", request.model);
    form.set("prompt", request.prompt);
    form.set("size", size);
    form.set("quality", "medium");
    form.set("output_format", "png");
    for (const [index, url] of request.inputAssetUrls!.slice(0, 6).entries()) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
      let mimeType: string; let bytes: BlobPart;
      if (match) { mimeType = match[1]!; bytes = Buffer.from(match[2]!, "base64"); }
      else {
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error("Routie tidak dapat mengambil gambar referensi dengan aman.");
        mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
        if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) throw new Error("Format gambar referensi belum didukung.");
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0 || buffer.byteLength > 10 * 1024 * 1024) throw new Error("Ukuran gambar referensi tidak valid.");
        bytes = buffer;
      }
      form.append("image[]", new Blob([bytes], { type: mimeType }), `reference-${index}.${mimeType.split("/")[1]}`);
    }
    const response = await providerFetch(this.provider, "https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Idempotency-Key": request.idempotencyKey }, body: form
    });
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const asset = payload.data?.[0];
    if (!asset) throw new Error("OpenAI returned no generated image");
    return { status: "COMPLETED", assetUrls: [asset.url ?? toDataUrl("image/png", asset.b64_json ?? "")], usage: { images: 1 } };
  }

  private async generateSpeech(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    const response = await providerFetch(this.provider, "https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({ model: request.model, voice: "alloy", input: request.prompt, response_format: "mp3" })
    });
    return { status: "COMPLETED", assetUrls: [toDataUrl("audio/mpeg", await response.arrayBuffer())] };
  }
}
