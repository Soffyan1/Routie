"use client";

import React, { useState } from "react";
import {
  Activity,
  BarChart2,
  Calendar,
  Eye,
  Film,
  Heart,
  Image as ImageIcon,
  Layers,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";
import type { AnalyticsSummary } from "@routie/domain";

interface AnalyticsChartsProps {
  summary: AnalyticsSummary;
}

export function AnalyticsCharts({ summary }: AnalyticsChartsProps) {
  const [metricMode, setMetricMode] = useState<"reach" | "impressions" | "engagements">("reach");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const trends = summary.dailyTrends || [];

  // Calculate SVG curve coordinates
  const width = 760;
  const height = 220;
  const paddingX = 30;
  const paddingY = 25;

  const dataValues = trends.map((t) => t[metricMode] || 0);
  const maxVal = Math.max(...dataValues, 100);
  const minVal = 0;

  const points = trends.map((t, idx) => {
    const x = paddingX + (idx / Math.max(trends.length - 1, 1)) * (width - paddingX * 2);
    const val = t[metricMode] || 0;
    const y = height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
    return { x, y, val, label: t.label, date: t.date };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x},${pt.y}`;
    const prev = points[idx - 1]!;
    const cp1x = prev.x + (pt.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (pt.x - prev.x) / 2;
    const cp2y = pt.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pt.x},${pt.y}`;
  }, "");

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1]!.x},${height - paddingY} L ${points[0]!.x},${height - paddingY} Z`
    : "";

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="crm-analytics-grid-two">
      {/* 1. Main Trend Chart */}
      <div className="crm-card crm-chart-card">
        <div className="crm-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={18} className="text-primary" />
              <h2 className="crm-card-title">Tren Performa & Pertumbuhan</h2>
            </div>
            <p className="crm-card-subtitle">
              Visualisasi jangkauan dan interaksi harian lintas channel sosial media
            </p>
          </div>

          <div className="crm-metric-tab-group">
            <button
              type="button"
              className={`crm-metric-tab-btn ${metricMode === "reach" ? "active" : ""}`}
              onClick={() => setMetricMode("reach")}
            >
              <Users size={13} />
              <span>Reach (Jangkauan)</span>
            </button>
            <button
              type="button"
              className={`crm-metric-tab-btn ${metricMode === "impressions" ? "active" : ""}`}
              onClick={() => setMetricMode("impressions")}
            >
              <Eye size={13} />
              <span>Impresi</span>
            </button>
            <button
              type="button"
              className={`crm-metric-tab-btn ${metricMode === "engagements" ? "active" : ""}`}
              onClick={() => setMetricMode("engagements")}
            >
              <Heart size={13} />
              <span>Interaksi</span>
            </button>
          </div>
        </div>

        <div className="crm-chart-svg-container">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="crm-trend-svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--crm-primary)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--crm-primary)" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--crm-border-subtle)" strokeDasharray="3 3" />
            <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--crm-border-subtle)" strokeDasharray="3 3" />
            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--crm-border-default)" />

            {/* Fill Area */}
            {areaD && <path d={areaD} fill="url(#chartGradient)" />}

            {/* Main Smooth Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="var(--crm-primary)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Circles */}
            {points.map((pt, idx) => (
              <g key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIdx === idx ? 6 : 3.5}
                  fill={hoveredIdx === idx ? "var(--crm-primary)" : "#FFFFFF"}
                  stroke="var(--crm-primary)"
                  strokeWidth={hoveredIdx === idx ? 2.5 : 1.8}
                  style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                />
              </g>
            ))}
          </svg>

          {/* Hover Tooltip overlay */}
          {activePoint && (
            <div
              className="crm-chart-tooltip"
              style={{
                left: `${(activePoint.x / width) * 100}%`,
                top: `${(activePoint.y / height) * 100}%`
              }}
            >
              <span className="crm-tooltip-date">{activePoint.label}</span>
              <span className="crm-tooltip-val">
                {metricMode === "reach" ? "Jangkauan" : metricMode === "impressions" ? "Impresi" : "Interaksi"}:{" "}
                <b>{activePoint.val.toLocaleString("id-ID")}</b>
              </span>
            </div>
          )}

          {/* X Axis Labels */}
          <div className="crm-chart-x-labels">
            {trends
              .filter((_, i) => i === 0 || i === Math.floor(trends.length / 2) || i === trends.length - 1)
              .map((t, idx) => (
                <span key={idx} className="crm-chart-label">
                  {t.label}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* 2. Platform & Format Performance Breakdown */}
      <div className="crm-analytics-side-col">
        {/* Platform Share Card */}
        <div className="crm-card crm-breakdown-card">
          <div className="crm-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={16} className="text-purple" />
              <h3 className="crm-card-title">Distribusi Antar Platform</h3>
            </div>
            <span className="crm-badge purple">
              <Sparkles size={11} />
              <span>Multi-channel</span>
            </span>
          </div>

          <div className="crm-platform-share-list">
            {(summary.platformDistribution || []).map((p) => {
              const color =
                p.channel === "INSTAGRAM"
                  ? "#E1306C"
                  : p.channel === "TIKTOK"
                  ? "#000000"
                  : p.channel === "FACEBOOK"
                  ? "#1877F2"
                  : "#6366F1";

              return (
                <div key={p.channel} className="crm-platform-share-item">
                  <div className="crm-share-header">
                    <div className="crm-share-title-wrap">
                      <span className="crm-channel-dot" style={{ background: color }} />
                      <span className="crm-share-name">{p.channel}</span>
                    </div>
                    <span className="crm-share-pct">{p.sharePercentage}%</span>
                  </div>
                  <div className="crm-progress-bar-bg">
                    <div
                      className="crm-progress-bar-fill"
                      style={{ width: `${p.sharePercentage}%`, background: color }}
                    />
                  </div>
                  <div className="crm-share-sub-metrics">
                    <span>Reach: <b>{p.reach.toLocaleString("id-ID")}</b></span>
                    <span>Interaksi: <b>{p.totalEngagements.toLocaleString("id-ID")}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Format Performance Card */}
        <div className="crm-card crm-breakdown-card">
          <div className="crm-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <BarChart2 size={16} className="text-green" />
              <h3 className="crm-card-title">Efektivitas Format Media</h3>
            </div>
          </div>

          <div className="crm-format-list">
            {(summary.formatDistribution || []).map((f) => (
              <div key={f.format} className="crm-format-item">
                <div className="crm-format-icon-wrap">
                  {f.format === "VIDEO" ? (
                    <Film size={15} />
                  ) : f.format === "CAROUSEL" ? (
                    <Layers size={15} />
                  ) : (
                    <ImageIcon size={15} />
                  )}
                </div>
                <div className="crm-format-info">
                  <div className="crm-format-row">
                    <b className="crm-format-label">{f.label}</b>
                    <span className="crm-badge green">ER {f.avgEngagement}%</span>
                  </div>
                  <div className="crm-format-sub">
                    <span>{f.count} Postingan</span>
                    <span>•</span>
                    <span>Rata-rata {f.avgReach.toLocaleString("id-ID")} Reach</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
