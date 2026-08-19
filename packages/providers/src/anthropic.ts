import type { AIProviderAdapter, GenerateRequest, GenerateResult, ProviderModel, ResearchSource } from "@routie/domain";
import { assertCapability, providerFetch } from "./base";

const models = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", capabilities: ["TEXT", "WEB_SEARCH"], lifecycle: "STABLE" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", capabilities: ["TEXT", "WEB_SEARCH"], lifecycle: "STABLE" }
] as const satisfies readonly ProviderModel[];

type AnthropicPayload = {
  content?: Array<{ type?: string; text?: string; citations?: Array<{ url?: string; title?: string; cited_text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } };
};

export class AnthropicAdapter implements AIProviderAdapter {
  readonly provider = "ANTHROPIC" as const;

  listModels() {
    return models;
  }

  async validateCredential(apiKey: string): Promise<boolean> {
    try {
      await providerFetch(this.provider, "https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      });
      return true;
    } catch {
      return false;
    }
  }

  async generate(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    assertCapability(models, request.model, request.capability);
    const response = await providerFetch(this.provider, "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 4096,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        ...(request.capability === "WEB_SEARCH" ? { tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 5, allowed_callers: ["direct"] }] } : {})
      })
    });
    const payload = (await response.json()) as AnthropicPayload;
    const citations = (payload.content ?? []).flatMap((block) => block.citations ?? []);
    const sources: ResearchSource[] = citations
      .filter((citation) => citation.url)
      .map((citation) => ({
        url: citation.url!,
        title: citation.title ?? citation.url!,
        ...(citation.cited_text !== undefined ? { excerpt: citation.cited_text } : {}),
        accessedAt: new Date()
      }));
    const usage = {
      ...(payload.usage?.input_tokens !== undefined ? { inputTokens: payload.usage.input_tokens } : {}),
      ...(payload.usage?.output_tokens !== undefined ? { outputTokens: payload.usage.output_tokens } : {}),
      ...(payload.usage?.server_tool_use?.web_search_requests !== undefined ? { searchCalls: payload.usage.server_tool_use.web_search_requests } : {})
    };
    return {
      status: "COMPLETED",
      text: (payload.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n"),
      sources,
      usage
    };
  }
}
