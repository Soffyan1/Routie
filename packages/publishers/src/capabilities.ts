import type { DeliveryMode, SocialCapability, SocialChannel } from "@routie/domain";

export interface ChannelFeatureFlags {
  meta: boolean;
  tiktok: boolean;
  tiktokDraft: boolean;
  threads: boolean;
  youtube: boolean;
}

export function deliveryModeFor(channel: SocialChannel, flags: ChannelFeatureFlags): DeliveryMode {
  if (channel === "X") return "EXPORT_MANUAL";
  if (channel === "FACEBOOK" || channel === "INSTAGRAM") return flags.meta ? "AUTO_PUBLISH" : "EXPORT_MANUAL";
  if (channel === "TIKTOK") return flags.tiktok ? "AUTO_PUBLISH" : "PLATFORM_DRAFT";
  if (channel === "THREADS") return flags.threads ? "AUTO_PUBLISH" : "EXPORT_MANUAL";
  return flags.youtube ? "AUTO_PUBLISH" : "EXPORT_MANUAL";
}

export function capabilityFor(channel: SocialChannel, flags: ChannelFeatureFlags): SocialCapability {
  const contentKinds: Record<SocialChannel, SocialCapability["contentKinds"]> = {
    FACEBOOK: ["TEXT", "IMAGE"],
    INSTAGRAM: ["IMAGE"],
    // TikTok Draft Sync supports single and multi-photo uploads as well as
    // short video. Direct Post remains a separate, consent-driven flow.
    TIKTOK: ["IMAGE", "SHORT_VIDEO"],
    THREADS: ["TEXT", "IMAGE"],
    YOUTUBE: ["SHORT_VIDEO"],
    X: ["TEXT", "IMAGE", "SHORT_VIDEO"]
  };
  return { channel, deliveryMode: deliveryModeFor(channel, flags), contentKinds: contentKinds[channel] };
}

export function flagsFromEnvironment(env: NodeJS.ProcessEnv = process.env): ChannelFeatureFlags {
  return {
    meta: env.ENABLE_META_AUTO_PUBLISH === "true",
    tiktok: env.ENABLE_TIKTOK_AUTO_PUBLISH === "true",
    tiktokDraft: env.ENABLE_TIKTOK_DRAFT_SYNC === "true",
    threads: env.ENABLE_THREADS_AUTO_PUBLISH === "true",
    youtube: env.ENABLE_YOUTUBE_AUTO_PUBLISH === "true"
  };
}
