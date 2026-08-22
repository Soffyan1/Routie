import type { AIProviderAdapter, ProviderCapability } from "@routie/domain";
import { AnthropicAdapter } from "./anthropic";
import { GeminiAdapter } from "./gemini";
import { OpenAIAdapter } from "./openai";
import { ZarkAdapter } from "./zark";

const adapters: Record<AIProviderAdapter["provider"], AIProviderAdapter> = {
  OPENAI: new OpenAIAdapter(),
  GEMINI: new GeminiAdapter(),
  ANTHROPIC: new AnthropicAdapter(),
  ZARK: new ZarkAdapter()
};

export function getProviderAdapter(provider: keyof typeof adapters): AIProviderAdapter {
  return adapters[provider];
}

export function providerRegistry() {
  return Object.values(adapters).map((adapter) => ({ provider: adapter.provider, models: adapter.listModels() }));
}

export function modelsForCapability(capability: ProviderCapability) {
  return Object.values(adapters).flatMap((adapter) =>
    adapter.listModels().filter((model) => model.capabilities.includes(capability)).map((model) => ({ provider: adapter.provider, ...model }))
  );
}
