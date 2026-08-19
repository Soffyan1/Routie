export interface ImagePromptInput {
  businessName: string;
  brief: string;
  targetAudience: string;
  tone: string;
  colors: string[];
  prohibitedClaims: string[];
  topic: string;
  hook: string;
  outline: string;
  contentPillar: string | null;
}

export function buildImagePrompt(input: ImagePromptInput) {
  return [
    `Create one polished square social-media key visual for ${input.businessName}.`,
    `Brand brief: ${input.brief || "a trustworthy modern Indonesian business"}.`,
    `Audience: ${input.targetAudience || "Indonesian social media users"}.`,
    `Content topic: ${input.topic}.`,
    `Creative hook: ${input.hook}.`,
    `Visual direction: ${input.outline}.`,
    `Content pillar: ${input.contentPillar || "general brand awareness"}.`,
    `Tone: ${input.tone || "clear, warm, and professional"}.`,
    input.colors.length > 0 ? `Use this brand color palette: ${input.colors.join(", ")}.` : "Use a harmonious modern color palette.",
    input.prohibitedClaims.length > 0 ? `Do not imply or visualize these prohibited claims: ${input.prohibitedClaims.join("; ")}.` : "Avoid unverifiable claims.",
    "Composition must work as a reusable master image across Instagram, Facebook, Threads, TikTok, YouTube, and X.",
    "Do not include readable text, logos, watermarks, UI screenshots, copyrighted characters, or platform branding. Leave useful negative space for a later caption overlay.",
    "Photorealistic commercial art direction, clean lighting, premium but approachable, culturally appropriate for Indonesia."
  ].join("\n");
}
