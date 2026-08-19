import { z } from "zod";
import { socialChannels, type SocialChannel } from "./types";

export const analyticsPeriodSchema = z.enum(["7d", "30d", "90d", "1y", "all"]);
export type AnalyticsPeriod = z.infer<typeof analyticsPeriodSchema>;

export interface SocialPostInsight {
  id: string;
  workspaceId: string;
  conceptId?: string | null;
  channel: SocialChannel;
  externalPostId: string;
  postUrl?: string | null;
  postTitle: string;
  postCaption?: string | null;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL" | "STORY";
  mediaUrl?: string | null;
  publishedAt: string; // ISO string
  viewsCount: number;
  reachCount: number;
  impressionsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  engagementRate: number; // e.g. 4.85 (%)
  performanceScore?: "VIRAL" | "HIGH" | "NORMAL" | "LOW";
}

export interface DailyWorkspaceMetric {
  id: string;
  workspaceId: string;
  date: string; // YYYY-MM-DD
  channel: string; // "ALL" | SocialChannel
  totalFollowers: number;
  newFollowers: number;
  totalReach: number;
  totalImpressions: number;
  totalEngagements: number;
  profileViews: number;
  websiteClicks: number;
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  channel: string;
  totalReach: number;
  reachGrowth: number; // percentage vs previous period, e.g. +14.2
  totalViews: number;
  viewsGrowth: number;
  totalEngagements: number;
  engagementGrowth: number;
  averageEngagementRate: number; // e.g. 4.6%
  totalFollowers: number;
  newFollowers: number;
  followerGrowth: number;
  connectedChannels: Array<{
    channel: SocialChannel;
    accountName: string;
    isConnected: boolean;
    followersCount: number;
  }>;
  dailyTrends: Array<{
    date: string;
    label: string; // "Sen", "19 Agu", etc.
    reach: number;
    impressions: number;
    engagements: number;
  }>;
  platformDistribution: Array<{
    channel: SocialChannel;
    sharePercentage: number;
    totalEngagements: number;
    reach: number;
  }>;
  formatDistribution: Array<{
    format: "IMAGE" | "VIDEO" | "CAROUSEL" | "STORY";
    label: string;
    count: number;
    avgReach: number;
    avgEngagement: number;
  }>;
  audienceDemographics: {
    gender: {
      female: number; // %
      male: number; // %
      other: number; // %
    };
    ageRanges: Array<{
      range: string;
      percentage: number;
    }>;
    topCities: Array<{
      city: string;
      percentage: number;
    }>;
  };
  smartInsights: {
    topPost?: SocialPostInsight | undefined;
    bestPostingTimes: Array<{
      day: string;
      time: string;
      reason: string;
    }>;
    aiRecommendation: string;
  };
}
