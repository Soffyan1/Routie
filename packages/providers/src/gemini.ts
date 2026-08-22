import type { AIProviderAdapter, GenerateRequest, GenerateResult, ProviderModel, ProviderPollResult, ResearchSource } from "@routie/domain";
import { assertCapability, providerFetch, toDataUrl } from "./base";

const models = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", capabilities: ["TEXT", "WEB_SEARCH"], lifecycle: "STABLE" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", capabilities: ["TEXT", "WEB_SEARCH"], lifecycle: "STABLE" },
  { id: "gemini-3.1-flash-lite-image", label: "Gemini 3.1 Flash Lite Image", capabilities: ["IMAGE"], lifecycle: "STABLE" },
  { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image", capabilities: ["IMAGE"], lifecycle: "STABLE" },
  { id: "veo-3.1-generate-preview", label: "Veo 3.1", capabilities: ["VIDEO"], lifecycle: "PREVIEW" },
  { id: "gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS", capabilities: ["TTS"], lifecycle: "PREVIEW" }
] as const satisfies readonly ProviderModel[];

type GeminiPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  name?: string;
  done?: boolean;
  response?: { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } };
  error?: { code?: number; message?: string };
};

async function inputParts(urls: string[] | undefined): Promise<Array<{ inlineData: { mimeType: string; data: string } }>> {
  if (!urls?.length) return [];
  return Promise.all(urls.slice(0, 6).map(async (url) => {
    const dataMatch = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (dataMatch) return { inlineData: { mimeType: dataMatch[1]!, data: dataMatch[2]! } };
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Routie tidak dapat mengambil gambar referensi dengan aman.");
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) throw new Error("Format gambar referensi belum didukung.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) throw new Error("Ukuran gambar referensi tidak valid.");
    return { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } };
  }));
}

export class GeminiAdapter implements AIProviderAdapter {
  readonly provider = "GEMINI" as const;

  listModels() {
    return models;
  }

  async validateCredential(apiKey: string): Promise<boolean> {
    try {
      await providerFetch(this.provider, `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {});
      return true;
    } catch {
      return false;
    }
  }

  async generate(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    assertCapability(models, request.model, request.capability);
    if (request.capability === "VIDEO") return this.generateVideo(apiKey, request);
    const isTts = request.capability === "TTS";
    const body = {
      contents: [{ role: "user", parts: [{ text: [request.system, request.prompt].filter(Boolean).join("\n\n") }, ...(request.capability === "IMAGE" ? await inputParts(request.inputAssetUrls) : [])] }],
      ...(request.capability === "WEB_SEARCH" ? { tools: [{ google_search: {} }] } : {}),
      ...(request.capability === "IMAGE" ? { generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: request.aspectRatio ?? "1:1" } } } : {}),
      ...(isTts ? { generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } } } : {})
    };
    const response = await providerFetch(
      this.provider,
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Request-Id": request.idempotencyKey }, body: JSON.stringify(body) }
    );
    const payload = (await response.json()) as GeminiPayload;
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const assets = parts
      .filter((part) => part.inlineData?.data)
      .map((part) => toDataUrl(part.inlineData?.mimeType ?? (isTts ? "audio/wav" : "image/png"), part.inlineData?.data ?? ""));
    const sources: ResearchSource[] = (payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .filter((chunk) => chunk.web?.uri)
      .map((chunk) => ({ url: chunk.web!.uri!, title: chunk.web?.title ?? chunk.web!.uri!, accessedAt: new Date() }));
    const usage = {
      ...(payload.usageMetadata?.promptTokenCount !== undefined ? { inputTokens: payload.usageMetadata.promptTokenCount } : {}),
      ...(payload.usageMetadata?.candidatesTokenCount !== undefined ? { outputTokens: payload.usageMetadata.candidatesTokenCount } : {}),
      ...(request.capability === "IMAGE" ? { images: assets.length } : {})
    };
    return {
      status: "COMPLETED",
      text: parts.map((part) => part.text ?? "").filter(Boolean).join("\n"),
      assetUrls: assets,
      sources,
      usage
    };
  }

  private async generateVideo(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    const response = await providerFetch(
      this.provider,
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:predictLongRunning?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Request-Id": request.idempotencyKey },
        body: JSON.stringify({ instances: [{ prompt: request.prompt }], parameters: { aspectRatio: request.aspectRatio ?? "9:16", durationSeconds: request.durationSeconds ?? 8 } })
      }
    );
    const payload = (await response.json()) as GeminiPayload;
    if (!payload.name) throw new Error("Gemini returned no video operation name");
    return { providerJobId: payload.name, status: "PROCESSING" };
  }

  async poll(apiKey: string, providerJobId: string): Promise<ProviderPollResult> {
    const response = await providerFetch(this.provider, `https://generativelanguage.googleapis.com/v1beta/${providerJobId}?key=${encodeURIComponent(apiKey)}`, {});
    const payload = (await response.json()) as GeminiPayload;
    if (!payload.done) return { providerJobId, status: "PROCESSING" };
    if (payload.error) {
      return { status: "COMPLETED", error: { code: String(payload.error.code ?? "VIDEO_FAILED"), message: payload.error.message ?? "Video generation failed", retryable: false, provider: this.provider } };
    }
    const urls = (payload.response?.generateVideoResponse?.generatedSamples ?? []).map((sample) => sample.video?.uri).filter((url): url is string => Boolean(url));
    return { providerJobId, status: "COMPLETED", assetUrls: urls };
  }
}
