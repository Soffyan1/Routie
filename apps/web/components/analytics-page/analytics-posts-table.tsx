"use client";

import React, { useState } from "react";
import {
  ArrowUpDown,
  Bookmark,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  Film,
  Flame,
  Heart,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Search,
  Share2,
  Sparkles
} from "lucide-react";
import type { SocialPostInsight } from "@routie/domain";

interface AnalyticsPostsTableProps {
  posts: SocialPostInsight[];
  onExportCsv?: () => void;
  isExporting?: boolean;
}

export function AnalyticsPostsTable({ posts, onExportCsv, isExporting }: AnalyticsPostsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("publishedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Filtering
  const filtered = posts.filter((p) => {
    const matchesSearch =
      p.postTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.postCaption && p.postCaption.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFormat = formatFilter === "ALL" || p.mediaType === formatFilter;

    return matchesSearch && matchesFormat;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let valA: any = (a as any)[sortBy] ?? 0;
    let valB: any = (b as any)[sortBy] ?? 0;
    if (sortBy === "publishedAt") {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }
    return sortOrder === "desc" ? valB - valA : valA - valB;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="crm-card crm-posts-table-card">
      <div className="crm-card-header crm-table-header-wrap">
        <div>
          <h3 className="crm-card-title">Rincian Performa per Konten</h3>
          <p className="crm-card-subtitle">
            Daftar lengkap konten yang sudah dipublikasikan beserta metrik keterlibatan detail
          </p>
        </div>

        <div className="crm-table-controls">
          {/* Search Box */}
          <div className="crm-search-box-compact">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Cari judul konten..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Format Filter */}
          <div className="crm-format-select-wrap">
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="crm-select-compact"
            >
              <option value="ALL">Semua Format</option>
              <option value="CAROUSEL">Carousel</option>
              <option value="VIDEO">Video / Reels</option>
              <option value="IMAGE">Single Image</option>
            </select>
          </div>

          {/* Export Button */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={isExporting}
              className="crm-btn crm-btn-secondary crm-btn-sm"
              title="Unduh Data CSV"
            >
              <Download size={13} />
              <span>{isExporting ? "Mengunduh..." : "Export CSV"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="crm-table-responsive-wrapper">
        <table className="crm-analytics-table">
          <thead>
            <tr>
              <th style={{ width: "38%" }} onClick={() => handleSort("postTitle")}>
                <div className="crm-th-content">
                  <span>Konten & Topik</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("channel")}>
                <div className="crm-th-content">
                  <span>Channel</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("publishedAt")}>
                <div className="crm-th-content">
                  <span>Tayang</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("reachCount")} style={{ textAlign: "right" }}>
                <div className="crm-th-content" style={{ justifyContent: "flex-end" }}>
                  <span>Reach</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("likesCount")} style={{ textAlign: "right" }}>
                <div className="crm-th-content" style={{ justifyContent: "flex-end" }}>
                  <span>Likes</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("commentsCount")} style={{ textAlign: "right" }}>
                <div className="crm-th-content" style={{ justifyContent: "flex-end" }}>
                  <span>Komentar</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("sharesCount")} style={{ textAlign: "right" }}>
                <div className="crm-th-content" style={{ justifyContent: "flex-end" }}>
                  <span>Share</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("savesCount")} style={{ textAlign: "right" }}>
                <div className="crm-th-content" style={{ justifyContent: "flex-end" }}>
                  <span>Saves</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort("engagementRate")} style={{ textAlign: "right" }}>
                <div className="crm-th-content" style={{ justifyContent: "flex-end" }}>
                  <span>ER %</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th style={{ width: "60px", textAlign: "center" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? (
              sorted.map((p) => {
                const erBadgeClass =
                  p.engagementRate >= 10
                    ? "green"
                    : p.engagementRate >= 5
                    ? "blue"
                    : "gray";

                return (
                  <tr key={p.id} className="crm-table-row">
                    <td>
                      <div className="crm-post-col-cell">
                        {p.mediaUrl ? (
                          <div className="crm-table-thumb">
                            <img src={p.mediaUrl} alt={p.postTitle} />
                            <span className="crm-thumb-format-badge">
                              {p.mediaType === "VIDEO" ? (
                                <Film size={10} />
                              ) : p.mediaType === "CAROUSEL" ? (
                                <Layers size={10} />
                              ) : (
                                <ImageIcon size={10} />
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="crm-table-thumb-placeholder">
                            <ImageIcon size={14} />
                          </div>
                        )}
                        <div className="crm-post-col-info">
                          <b className="crm-post-col-title">{p.postTitle}</b>
                          {p.postCaption && (
                            <span className="crm-post-col-caption">
                              {p.postCaption}
                            </span>
                          )}
                          {p.performanceScore === "VIRAL" && (
                            <span className="crm-score-tag viral">
                              <Flame size={10} />
                              <span>Viral</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="crm-platform-badge-pill">
                        {p.channel}
                      </span>
                    </td>
                    <td>
                      <span className="crm-date-cell">
                        {new Date(p.publishedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short"
                        })}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {p.reachCount.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.likesCount.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.commentsCount.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.sharesCount.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.savesCount.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`crm-badge ${erBadgeClass}`}>
                        {p.engagementRate.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {p.postUrl ? (
                        <a
                          href={p.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="crm-action-icon-btn"
                          title="Buka Postingan Asli"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--crm-text-muted)" }}>
                  Tidak ada konten yang sesuai dengan filter pencarian.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
