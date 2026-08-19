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

  private async generateSpeech(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    const response = await providerFetch(this.provider, "https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({ model: request.model, voice: "alloy", input: request.prompt, response_format: "mp3" })
    });
    return { status: "COMPLETED", assetUrls: [toDataUrl("audio/mpeg", await response.arrayBuffer())] };
  }
}
