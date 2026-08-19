"use client";

import React from "react";
import { Globe2, MapPin, PieChart, Users2 } from "lucide-react";
import type { AnalyticsSummary } from "@routie/domain";

interface AnalyticsDemographicsProps {
  demographics?: AnalyticsSummary["audienceDemographics"];
}

export function AnalyticsDemographics({ demographics }: AnalyticsDemographicsProps) {
  if (!demographics) return null;

  const { gender, ageRanges, topCities } = demographics;

  return (
    <div className="crm-analytics-demographics-grid">
      {/* 1. Gender Distribution Card */}
      <div className="crm-card crm-demo-card">
        <div className="crm-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="crm-title-icon-box purple">
              <Users2 size={16} />
            </div>
            <div>
              <h3 className="crm-card-title">Komposisi Gender Audiens</h3>
              <p className="crm-card-subtitle">Proporsi pengikut dan penonton aktif</p>
            </div>
          </div>
        </div>

        <div className="crm-gender-bars-wrap">
          {/* Female Bar */}
          <div className="crm-gender-item">
            <div className="crm-gender-meta">
              <span className="crm-gender-label">👩 Wanita</span>
              <b className="crm-gender-val">{gender.female}%</b>
            </div>
            <div className="crm-progress-bar-bg">
              <div
                className="crm-progress-bar-fill"
                style={{ width: `${gender.female}%`, background: "#EC4899" }}
              />
            </div>
          </div>

          {/* Male Bar */}
          <div className="crm-gender-item">
            <div className="crm-gender-meta">
              <span className="crm-gender-label">👨 Pria</span>
              <b className="crm-gender-val">{gender.male}%</b>
            </div>
            <div className="crm-progress-bar-bg">
              <div
                className="crm-progress-bar-fill"
                style={{ width: `${gender.male}%`, background: "#3B82F6" }}
              />
            </div>
          </div>

          {/* Other Bar */}
          {gender.other > 0 && (
            <div className="crm-gender-item">
              <div className="crm-gender-meta">
                <span className="crm-gender-label">✨ Lainnya / Tidak Disebutkan</span>
                <b className="crm-gender-val">{gender.other}%</b>
              </div>
              <div className="crm-progress-bar-bg">
                <div
                  className="crm-progress-bar-fill"
                  style={{ width: `${gender.other}%`, background: "#9CA3AF" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Age Range Breakdown Card */}
      <div className="crm-card crm-demo-card">
        <div className="crm-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="crm-title-icon-box blue">
              <PieChart size={16} />
            </div>
            <div>
              <h3 className="crm-card-title">Rentang Usia Dominan</h3>
              <p className="crm-card-subtitle">Kelompok umur audiens paling aktif</p>
            </div>
          </div>
        </div>

        <div className="crm-age-ranges-list">
          {ageRanges.map((ar) => (
            <div key={ar.range} className="crm-age-range-item">
              <div className="crm-age-range-header">
                <span className="crm-age-label">{ar.range}</span>
                <b className="crm-age-pct">{ar.percentage}%</b>
              </div>
              <div className="crm-progress-bar-bg">
                <div
                  className="crm-progress-bar-fill"
                  style={{ width: `${ar.percentage}%`, background: "var(--crm-primary)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Top Cities Card */}
      <div className="crm-card crm-demo-card">
        <div className="crm-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="crm-title-icon-box green">
              <MapPin size={16} />
            </div>
            <div>
              <h3 className="crm-card-title">Top Kota & Lokasi Pengikut</h3>
              <p className="crm-card-subtitle">Sebaran geografis audiens di Indonesia</p>
            </div>
          </div>
        </div>

        <div className="crm-cities-list">
          {topCities.map((city, idx) => (
            <div key={city.city} className="crm-city-item">
              <div className="crm-city-left">
                <span className="crm-city-rank">{idx + 1}</span>
                <span className="crm-city-name">{city.city}</span>
              </div>
              <div className="crm-city-right">
                <b className="crm-city-pct">{city.percentage}%</b>
                <div className="crm-city-mini-bar">
                  <div
                    className="crm-city-bar-fill"
                    style={{ width: `${(city.percentage / (topCities[0]?.percentage || 40)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
