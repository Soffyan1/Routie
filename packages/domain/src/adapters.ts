import type {
  DeliveryMode,
  NormalizedError,
  ProviderCapability,
  ResearchSource,
  SocialChannel,
  UsageRecord
} from "./types";

export interface ProviderModel {
  id: string;
  label: string;
  capabilities: ProviderCapability[];
  lifecycle: "STABLE" | "PREVIEW" | "DEPRECATED";
}

export interface GenerateRequest {
  capability: ProviderCapability;
  model: string;
  prompt: string;
  system?: string;
  inputAssetUrls?: string[];
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  durationSeconds?: number;
  idempotencyKey: string;
}

export interface GenerateResult {
  providerJobId?: string;
  status: "COMPLETED" | "PROCESSING";
  text?: string;
  assetUrls?: string[];
  sources?: ResearchSource[];
  usage?: UsageRecord;
}

export interface ProviderPollResult extends GenerateResult {
  error?: NormalizedError;
}

export interface AIProviderAdapter {
  readonly provider: "OPENAI" | "GEMINI" | "ANTHROPIC";
  validateCredential(apiKey: string): Promise<boolean>;
  listModels(): readonly ProviderModel[];
  generate(apiKey: string, request: GenerateRequest): Promise<GenerateResult>;
  poll?(apiKey: string, providerJobId: string): Promise<ProviderPollResult>;
}

export interface SocialCapability {
  channel: SocialChannel;
  deliveryMode: DeliveryMode;
  contentKinds: Array<"TEXT" | "IMAGE" | "CAROUSEL" | "SHORT_VIDEO" | "STORY">;
}

export interface PublishRequest {
  connectionId: string;
  channel: SocialChannel;
  externalAccountId: string;
  caption: string;
  mediaUrls: string[];
  contentKind: SocialCapability["contentKinds"][number];
  scheduledFor: Date;
  idempotencyKey: string;
}

export interface PublishResult {
  status: "PUBLISHED" | "PROCESSING" | "EXPORTED";
  externalPostId?: string;
  externalUrl?: string;
  providerJobId?: string;
}

export interface SocialPublisherAdapter {
  readonly channel: SocialChannel;
  getCapability(): SocialCapability;
  validate(request: PublishRequest): void;
  publish(accessToken: string | null, request: PublishRequest): Promise<PublishResult>;
  reconcile?(accessToken: string, providerJobId: string): Promise<PublishResult>;
  refreshToken?(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }>;
}
