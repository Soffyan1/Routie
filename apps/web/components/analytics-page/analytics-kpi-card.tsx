"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface AnalyticsKpiCardProps {
  title: string;
  value: string | number;
  delta?: number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
}

export function AnalyticsKpiCard({
  title,
  value,
  delta,
  subtitle,
  icon,
  iconBg = "#EFF6FF",
  iconColor = "#2563EB",
  badge
}: AnalyticsKpiCardProps) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div className="crm-card crm-kpi-card">
      <div className="crm-kpi-header">
        <div className="crm-kpi-icon-wrap" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        {delta !== undefined && (
          <div
            className={`crm-kpi-delta ${
              isPositive ? "positive" : isNegative ? "negative" : "neutral"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight size={13} />
            ) : isNegative ? (
              <ArrowDownRight size={13} />
            ) : (
              <Minus size={13} />
            )}
            <span>
              {isPositive ? "+" : ""}
              {delta}%
            </span>
          </div>
        )}
        {badge && <span className="crm-kpi-badge">{badge}</span>}
      </div>

      <div className="crm-kpi-body">
        <span className="crm-kpi-title">{title}</span>
        <div className="crm-kpi-val-row">
          <h3 className="crm-kpi-value">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</h3>
        </div>
        {subtitle && <p className="crm-kpi-sub">{subtitle}</p>}
      </div>
    </div>
  );
}
