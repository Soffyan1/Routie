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
  ALLOW_DEMO_SESSION: z.enum(["true", "false"]).default("false")
});

export function serverEnv() {
  return envSchema.parse(process.env);
}
