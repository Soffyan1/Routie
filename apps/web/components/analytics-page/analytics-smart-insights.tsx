"use client";

import React from "react";
import {
  Bookmark,
  Clock,
  ExternalLink,
  Flame,
  Heart,
  Lightbulb,
  MessageCircle,
  Share2,
  Sparkles,
  Trophy,
  Zap
} from "lucide-react";
import type { AnalyticsSummary, SocialPostInsight } from "@routie/domain";

interface AnalyticsSmartInsightsProps {
  summary: AnalyticsSummary;
  topPost?: SocialPostInsight | undefined;
}

export function AnalyticsSmartInsights({ summary, topPost }: AnalyticsSmartInsightsProps) {
  const bestTimes = summary.smartInsights?.bestPostingTimes || [];
  const recommendation = summary.smartInsights?.aiRecommendation;
  const bestPost = topPost || summary.smartInsights?.topPost;

  return (
    <div className="crm-smart-insights-grid">
      {/* 1. Top Performing Post Highlight */}
      <div className="crm-card crm-top-post-card">
        <div className="crm-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="crm-title-icon-box amber">
              <Trophy size={16} />
            </div>
            <div>
              <h3 className="crm-card-title">Konten Performa Terbaik</h3>
              <p className="crm-card-subtitle">Engagement rate dan rasio share tertinggi periode ini</p>
            </div>
          </div>
          <span className="crm-badge green">
            <Flame size={12} />
            <span>Top Performer</span>
          </span>
        </div>

        {bestPost ? (
          <div className="crm-top-post-content">
            {bestPost.mediaUrl && (
              <div className="crm-top-post-media">
                <img src={bestPost.mediaUrl} alt={bestPost.postTitle} />
                <span className="crm-channel-badge-floating">{bestPost.channel}</span>
              </div>
            )}
            <div className="crm-top-post-details">
              <span className="crm-top-post-date">
                Tayang pada {new Date(bestPost.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </span>
              <h4 className="crm-top-post-title">{bestPost.postTitle}</h4>
              {bestPost.postCaption && (
                <p className="crm-top-post-caption">{bestPost.postCaption}</p>
              )}

              {/* Metrics Pill Grid */}
              <div className="crm-top-metrics-row">
                <div className="crm-top-metric-item">
                  <span className="crm-top-m-label">Reach</span>
                  <b className="crm-top-m-val">{bestPost.reachCount.toLocaleString("id-ID")}</b>
                </div>
                <div className="crm-top-metric-item">
                  <span className="crm-top-m-label">Likes</span>
                  <b className="crm-top-m-val">{bestPost.likesCount.toLocaleString("id-ID")}</b>
                </div>
                <div className="crm-top-metric-item">
                  <span className="crm-top-m-label">Comments</span>
                  <b className="crm-top-m-val">{bestPost.commentsCount.toLocaleString("id-ID")}</b>
                </div>
                <div className="crm-top-metric-item">
                  <span className="crm-top-m-label">Saves</span>
                  <b className="crm-top-m-val">{bestPost.savesCount.toLocaleString("id-ID")}</b>
                </div>
                <div className="crm-top-metric-item highlight">
                  <span className="crm-top-m-label">ER %</span>
                  <b className="crm-top-m-val">{bestPost.engagementRate}%</b>
                </div>
              </div>

              {bestPost.postUrl && (
                <div className="crm-top-post-actions">
                  <a
                    href={bestPost.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="crm-btn crm-btn-secondary crm-btn-sm"
                  >
                    <ExternalLink size={13} />
                    <span>Lihat di {bestPost.channel}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted p-4">Belum ada data postingan.</p>
        )}
      </div>

      {/* 2. Best Posting Time & AI Recommendations */}
      <div className="crm-card crm-insights-side-card">
        {/* Best Posting Times */}
        <div className="crm-insights-sub-block">
          <div className="crm-insights-sub-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="crm-title-icon-box blue">
                <Clock size={16} />
              </div>
              <h3 className="crm-card-title">Waktu Posting Terbaik</h3>
            </div>
            <span className="crm-badge blue">Algoritma AI</span>
          </div>

          <div className="crm-best-times-list">
            {bestTimes.map((bt, idx) => (
              <div key={idx} className="crm-best-time-item">
                <div className="crm-time-day-pill">
                  <b>{bt.day}</b>
                  <span>{bt.time}</span>
                </div>
                <span className="crm-time-reason">{bt.reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strategic AI Recommendation */}
        {recommendation && (
          <div className="crm-ai-recommendation-box">
            <div className="crm-ai-rec-header">
              <Sparkles size={16} className="text-primary" />
              <b>Saran AI untuk Konten Selanjutnya</b>
            </div>
            <p className="crm-ai-rec-text">{recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
