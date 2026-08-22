import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  DATABASE_INTEGRATION_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32),
  ENVELOPE_MASTER_KEY: z.string().min(40),
  SERVER_PULSA_BASE_URL: z.url(),
  SERVER_PULSA_SERVICE_TOKEN: z.string().min(1),
  SERVER_PULSA_WEBHOOK_SECRET: z.string().min(1),
  ALLOW_DEMO_SESSION: z.enum(["true", "false"]).default("false"),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().optional(),
  TIKTOK_SCOPES: z.string().optional(),
  TIKTOK_MEDIA_URL_PREFIX: z.url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v24.0"),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),
  THREADS_REDIRECT_URI: z.string().optional(),
  ENABLE_META_AUTO_PUBLISH: z.enum(["true", "false"]).default("false"),
  ENABLE_TIKTOK_AUTO_PUBLISH: z.enum(["true", "false"]).default("false"),
  ENABLE_TIKTOK_DRAFT_SYNC: z.enum(["true", "false"]).default("false"),
  ENABLE_THREADS_AUTO_PUBLISH: z.enum(["true", "false"]).default("false"),
  ENABLE_YOUTUBE_AUTO_PUBLISH: z.enum(["true", "false"]).default("false"),
  ENABLE_ZARK_PROVIDER: z.enum(["true", "false"]).default("false"),
  ZARK_PILOT_MONTHLY_IMAGE_LIMIT: z.coerce.number().int().min(1).max(500).default(25),
  ZARK_API_BASE_URL: z.url().optional()
});

function loadEnvFallback() {
  const possiblePaths = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env")
  ];

  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
          const [key, ...rest] = trimmed.split("=");
          const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

export function serverEnv() {
  loadEnvFallback();
  return envSchema.parse(process.env);
}
