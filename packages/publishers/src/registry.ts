import type { SocialChannel, SocialPublisherAdapter } from "@routie/domain";
import { flagsFromEnvironment } from "./capabilities";
import { ExportPublisher } from "./export";
import { MetaPublisher } from "./meta";
import { TikTokPublisher } from "./tiktok";
import { YouTubePublisher } from "./youtube";

export function getSocialPublisher(channel: SocialChannel, env: NodeJS.ProcessEnv = process.env): SocialPublisherAdapter {
  const flags = flagsFromEnvironment(env);
  if (channel === "X") return new ExportPublisher(channel, flags);
  if ((channel === "FACEBOOK" || channel === "INSTAGRAM") && flags.meta) return new MetaPublisher(channel, flags);
  if (channel === "THREADS" && flags.threads) return new MetaPublisher(channel, flags);
  if (channel === "TIKTOK" && flags.tiktok) return new TikTokPublisher(flags);
  if (channel === "YOUTUBE" && flags.youtube) return new YouTubePublisher(flags);
  return new ExportPublisher(channel, flags);
}

export function channelRegistry(env: NodeJS.ProcessEnv = process.env) {
  const channels: SocialChannel[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "THREADS", "YOUTUBE", "X"];
  return channels.map((channel) => getSocialPublisher(channel, env).getCapability());
}
