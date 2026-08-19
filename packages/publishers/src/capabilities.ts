import type { DeliveryMode, SocialCapability, SocialChannel } from "@routie/domain";

export interface ChannelFeatureFlags {
  meta: boolean;
  tiktok: boolean;
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
    FACEBOOK: ["TEXT", "IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"],
    INSTAGRAM: ["IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"],
    TIKTOK: ["IMAGE", "SHORT_VIDEO"],
    THREADS: ["TEXT", "IMAGE", "CAROUSEL", "SHORT_VIDEO"],
    YOUTUBE: ["SHORT_VIDEO"],
    X: ["TEXT", "IMAGE", "SHORT_VIDEO"]
  };
  return { channel, deliveryMode: deliveryModeFor(channel, flags), contentKinds: contentKinds[channel] };
}

export function flagsFromEnvironment(env: NodeJS.ProcessEnv = process.env): ChannelFeatureFlags {
  return {
    meta: env.ENABLE_META_AUTO_PUBLISH === "true",
    tiktok: env.ENABLE_TIKTOK_AUTO_PUBLISH === "true",
    threads: env.ENABLE_THREADS_AUTO_PUBLISH === "true",
    youtube: env.ENABLE_YOUTUBE_AUTO_PUBLISH === "true"
  };
}
