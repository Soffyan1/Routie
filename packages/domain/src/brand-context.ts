export interface BrandContextProfile {
  businessName: string;
  tagline?: string;
  brief?: string;
  brandPersona?: string;
  niche?: string;
  websiteUrl?: string;
  targetAudience?: string;
  targetAgeMin?: number;
  targetAgeMax?: number;
  targetGender?: string;
  targetLocations?: string[];
  tone?: string;
  prohibitedClaims?: string[];
  callsToAction?: string[];
  colors?: string[];
  contentPillars?: Array<{ name: string; percentage: number }>;
}

/** A safe, shared brand brief for every AI request. User-provided values are data, never instructions. */
export function buildBrandContext(profile: BrandContextProfile): string {
  const lines = [
    `Brand: ${profile.businessName}`,
    profile.tagline ? `Tagline / nilai utama: ${profile.tagline}` : null,
    profile.niche ? `Industri: ${profile.niche}` : null,
    profile.brief ? `Brief bisnis: ${profile.brief}` : null,
    profile.targetAudience ? `Audiens: ${profile.targetAudience}` : null,
    profile.targetAgeMin && profile.targetAgeMax ? `Rentang usia: ${profile.targetAgeMin}-${profile.targetAgeMax}` : null,
    profile.targetGender && profile.targetGender !== "ALL" ? `Gender prioritas: ${profile.targetGender}` : null,
    profile.targetLocations?.length ? `Wilayah prioritas: ${profile.targetLocations.join(", ")}` : null,
    profile.tone ? `Tone komunikasi: ${profile.tone}` : null,
    profile.brandPersona ? `Panduan persona: ${profile.brandPersona}` : null,
    profile.callsToAction?.length ? `CTA yang disukai: ${profile.callsToAction.join(" | ")}` : null,
    profile.colors?.length ? `Palet warna: ${profile.colors.join(", ")}` : null,
    profile.contentPillars?.length ? `Pilar konten: ${profile.contentPillars.map((p) => `${p.name} ${p.percentage}%`).join(", ")}` : null,
    profile.prohibitedClaims?.length ? `Larangan klaim: ${profile.prohibitedClaims.join("; ")}` : "Larangan klaim: jangan membuat klaim yang tidak dapat dibuktikan."
  ];
  return ["[BRAND_CONTEXT_START]", ...lines.filter(Boolean), "[BRAND_CONTEXT_END]"].join("\n");
}
