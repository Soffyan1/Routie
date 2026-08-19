import { z } from "zod";

export const workspaceRoles = ["OWNER", "EDITOR", "APPROVER"] as const;
export const providerCapabilities = ["TEXT", "WEB_SEARCH", "IMAGE", "VIDEO", "TTS"] as const;
export const socialChannels = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "THREADS", "YOUTUBE", "X"] as const;
export const deliveryModes = ["AUTO_PUBLISH", "PLATFORM_DRAFT", "EXPORT_MANUAL"] as const;
export const entitlementStatuses = ["ACTIVE", "GRACE", "BLOCKED", "PURGE_PENDING"] as const;
export const contentStates = [
  "IDEA_DRAFT",
  "IDEA_REVIEW",
  "IDEA_APPROVED",
  "GENERATING",
  "FINAL_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "REJECTED",
  "HELD",
  "FAILED"
] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];
export type ProviderCapability = (typeof providerCapabilities)[number];
export type SocialChannel = (typeof socialChannels)[number];
export type DeliveryMode = (typeof deliveryModes)[number];
export type EntitlementStatus = (typeof entitlementStatuses)[number];
export type ContentState = (typeof contentStates)[number];

export const workspaceRoleSchema = z.enum(workspaceRoles);
export const providerCapabilitySchema = z.enum(providerCapabilities);
export const socialChannelSchema = z.enum(socialChannels);
export const deliveryModeSchema = z.enum(deliveryModes);
export const entitlementStatusSchema = z.enum(entitlementStatuses);
export const contentStateSchema = z.enum(contentStates);

export const planLimitsSchema = z.object({
  maxConceptsPerDay: z.number().int().min(1).max(3).default(3),
  maxMembers: z.number().int().min(1).default(5),
  maxStorageBytes: z.number().int().positive().default(20 * 1024 ** 3)
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const DEFAULT_PLAN_LIMITS: PlanLimits = Object.freeze({
  maxConceptsPerDay: 3,
  maxMembers: 5,
  maxStorageBytes: 20 * 1024 ** 3
});

export interface Actor {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface ResearchSource {
  url: string;
  title: string;
  accessedAt: Date;
  excerpt?: string;
}

export interface NormalizedError {
  code: string;
  message: string;
  retryable: boolean;
  provider?: string;
  retryAfterMs?: number;
  details?: Record<string, unknown>;
}

export interface UsageRecord {
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  audioSeconds?: number;
  videoSeconds?: number;
  searchCalls?: number;
}
