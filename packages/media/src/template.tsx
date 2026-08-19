import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame } from "remotion";

export interface BrandShortProps extends Record<string, unknown> {
  title: string;
  subtitle: string;
  imageUrl: string;
  audioUrl?: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
}

export function BrandShort({ title, subtitle, imageUrl, audioUrl, primaryColor, accentColor, logoUrl }: BrandShortProps) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, 22], [60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ backgroundColor: primaryColor, color: "white", fontFamily: "Arial, sans-serif", overflow: "hidden" }}>
    <Img src={imageUrl} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: .56 }} />
    <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 20%, ${primaryColor}ee 92%)` }} />
    {logoUrl && <Img src={logoUrl} style={{ position: "absolute", top: 70, left: 64, width: 130, height: 130, objectFit: "contain" }} />}
    <div style={{ position: "absolute", left: 64, right: 64, bottom: 150, opacity, transform: `translateY(${translateY}px)` }}>
      <div style={{ width: 76, height: 8, marginBottom: 26, backgroundColor: accentColor, borderRadius: 8 }} />
      <h1 style={{ margin: 0, fontSize: 78, lineHeight: 1.02, letterSpacing: -3 }}>{title}</h1>
      <p style={{ margin: "26px 0 0", fontSize: 32, lineHeight: 1.35, opacity: .88 }}>{subtitle}</p>
    </div>
    {audioUrl && <Audio src={audioUrl} />}
  </AbsoluteFill>;
}
