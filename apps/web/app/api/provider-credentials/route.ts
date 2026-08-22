import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { auditEvents, createDatabase, providerCredentials, withTenant } from "@routie/db";
import { providerCapabilitySchema } from "@routie/domain";
import { getProviderAdapter, isZarkPilotEnabled, zarkPilotMonthlyImageLimit } from "@routie/providers";
import { encryptSecret } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const fullCredentialSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI", "ANTHROPIC", "ZARK"]),
  capability: providerCapabilitySchema,
  model: z.string().min(1).max(100),
  apiKey: z.string().min(10).max(1_000)
});

const easyGoogleAiSchema = z.object({
  apiKey: z.string().min(10).max(1_000),
  provider: z.literal("GEMINI").optional()
});

const mediaAssetSchema = z.object({
  type: z.literal("MEDIA_ASSET").optional(),
  provider: z.enum(["OPENAI", "GEMINI", "ZARK"]).default("OPENAI"),
  apiKey: z.string().min(10).max(1_000)
});

type ProviderName = "OPENAI" | "GEMINI" | "ANTHROPIC" | "ZARK";

function providerLabel(provider: ProviderName): string {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Google AI";
  if (provider === "ANTHROPIC") return "Anthropic";
  return "Zark";
}

function assertZarkPilotAccess(
  provider: ProviderName,
  capability: string,
  env: { NODE_ENV?: string; ENABLE_ZARK_PROVIDER?: string }
): void {
  if (provider !== "ZARK") return;
  if (!isZarkPilotEnabled(env)) {
    throw new Error("Zark Pilot hanya tersedia di development saat ENABLE_ZARK_PROVIDER=true.");
  }
  if (capability !== "IMAGE") {
    throw new Error("Zark Pilot Routie saat ini hanya mendukung generasi gambar.");
  }
}

function utcMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function GET() {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);

    const credentials = await withTenant(db, session.workspaceId, (tx) =>
      tx
        .select({
          id: providerCredentials.id,
          provider: providerCredentials.provider,
          capability: providerCredentials.capability,
          model: providerCredentials.model,
          secretLastFour: providerCredentials.secretLastFour,
          validatedAt: providerCredentials.validatedAt
        })
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.workspaceId, session.workspaceId),
            isNull(providerCredentials.disabledAt)
          )
        )
    );

    const zarkEnabled = isZarkPilotEnabled(env);
    const visibleCredentials = credentials.filter((credential) => credential.provider !== "ZARK" || zarkEnabled);
    const textOrSearchCred = visibleCredentials.find((c) => c.capability === "TEXT" || c.capability === "WEB_SEARCH");
    const imageCred = visibleCredentials.find((c) => c.capability === "IMAGE");
    const isConfigured = visibleCredentials.length > 0;
    const monthlyLimit = zarkPilotMonthlyImageLimit(env);
    let attemptsThisMonth = 0;

    if (zarkEnabled) {
      const [usage] = await withTenant(db, session.workspaceId, (tx) =>
        tx
          .select({ value: count() })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.workspaceId, session.workspaceId),
              eq(auditEvents.action, "CONTENT_MEDIA_GENERATION_STARTED"),
              gte(auditEvents.createdAt, utcMonthStart()),
              sql`${auditEvents.after}->>'provider' = 'ZARK'`
            )
          )
      );
      attemptsThisMonth = usage?.value ?? 0;
    }

    return NextResponse.json({
      isConfigured,
      googleAi: {
        isConfigured: !!textOrSearchCred,
        provider: textOrSearchCred?.provider ?? null,
        secretLastFour: textOrSearchCred?.secretLastFour ?? null,
        validatedAt: textOrSearchCred?.validatedAt ?? null
      },
      mediaAsset: {
        isConfigured: !!imageCred,
        provider: imageCred?.provider ?? null,
        model: imageCred?.model ?? null,
        secretLastFour: imageCred?.secretLastFour ?? null,
        validatedAt: imageCred?.validatedAt ?? null
      },
      zarkPilot: {
        enabled: zarkEnabled,
        monthlyImageLimit: monthlyLimit,
        attemptsThisMonth,
        remainingThisMonth: Math.max(0, monthlyLimit - attemptsThisMonth)
      },
      provider: textOrSearchCred?.provider ?? visibleCredentials[0]?.provider ?? null,
      secretLastFour: textOrSearchCred?.secretLastFour ?? visibleCredentials[0]?.secretLastFour ?? null,
      validatedAt: textOrSearchCred?.validatedAt ?? visibleCredentials[0]?.validatedAt ?? null,
      capabilities: visibleCredentials.map((c) => c.capability),
      credentials: visibleCredentials
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role !== "OWNER") throw new Error("Hanya owner workspace yang dapat mengelola kunci AI.");

    const rawBody = await request.json();
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);

    // Case A: Dedicated Media Asset Generation setup (Image / Video)
    if (rawBody.type === "MEDIA_ASSET" || (rawBody.capability === "IMAGE" && !rawBody.model)) {
      const parsed = mediaAssetSchema.parse(rawBody);
      const cleanKey = parsed.apiKey.trim();
      const provider = parsed.provider;
      assertZarkPilotAccess(provider, "IMAGE", env);
      const model = provider === "OPENAI" ? "gpt-image-2" : provider === "GEMINI" ? "gemini-3.1-flash-image" : "auto";

      const adapter = getProviderAdapter(provider);
      const isValid = await adapter.validateCredential(cleanKey);
      if (!isValid) {
        throw new Error(`Kunci API ${providerLabel(provider)} tidak valid atau ditolak. Pastikan kunci disalin dengan benar.`);
      }

      const encryptedSecret = encryptSecret(
        cleanKey,
        env.ENVELOPE_MASTER_KEY,
        `${session.workspaceId}:${provider}:IMAGE`
      );

      await withTenant(db, session.workspaceId, async (tx) => {
        const now = new Date();
        await tx
          .update(providerCredentials)
          .set({ disabledAt: now, updatedAt: now })
          .where(
            and(
              eq(providerCredentials.workspaceId, session.workspaceId),
              eq(providerCredentials.capability, "IMAGE"),
              ne(providerCredentials.provider, provider),
              isNull(providerCredentials.disabledAt)
            )
          );
        await tx
          .insert(providerCredentials)
          .values({
            workspaceId: session.workspaceId,
            provider,
            capability: "IMAGE",
            model,
            encryptedSecret,
            secretLastFour: cleanKey.slice(-4),
            validatedAt: new Date(),
            disabledAt: null
          })
          .onConflictDoUpdate({
            target: [providerCredentials.workspaceId, providerCredentials.provider, providerCredentials.capability],
            set: {
              provider,
              model,
              encryptedSecret,
              secretLastFour: cleanKey.slice(-4),
              validatedAt: new Date(),
              disabledAt: null,
              updatedAt: new Date()
            }
          });
      });

      return NextResponse.json(
        {
          success: true,
          message: `Kunci API ${providerLabel(provider)} untuk generasi aset media sosial berhasil dihubungkan!`,
          provider,
          model,
          secretLastFour: cleanKey.slice(-4),
          validatedAt: new Date()
        },
        { status: 201 }
      );
    }

    // Case B: Simplified Google AI Studio setup (Text, Web Search, TTS)
    if ("apiKey" in rawBody && (!rawBody.capability || !rawBody.model || rawBody.provider === "GEMINI")) {
      const { apiKey } = easyGoogleAiSchema.parse(rawBody);
      const cleanKey = apiKey.trim();

      const adapter = getProviderAdapter("GEMINI");
      const isValid = await adapter.validateCredential(cleanKey);
      if (!isValid) {
        throw new Error("Kunci API Google AI Studio tidak valid atau ditolak oleh Google. Pastikan kunci disalin dengan benar dari Google AI Studio.");
      }

      const defaultGeminiCapabilities = [
        { capability: "TEXT" as const, model: "gemini-3.5-flash" },
        { capability: "WEB_SEARCH" as const, model: "gemini-3.5-flash" },
        { capability: "IMAGE" as const, model: "gemini-3.1-flash-image" },
        { capability: "TTS" as const, model: "gemini-3.1-flash-tts-preview" }
      ];

      await withTenant(db, session.workspaceId, async (tx) => {
        for (const item of defaultGeminiCapabilities) {
          const now = new Date();
          await tx
            .update(providerCredentials)
            .set({ disabledAt: now, updatedAt: now })
            .where(
              and(
                eq(providerCredentials.workspaceId, session.workspaceId),
                eq(providerCredentials.capability, item.capability),
                ne(providerCredentials.provider, "GEMINI"),
                isNull(providerCredentials.disabledAt)
              )
            );
          const encryptedSecret = encryptSecret(
            cleanKey,
            env.ENVELOPE_MASTER_KEY,
            `${session.workspaceId}:GEMINI:${item.capability}`
          );

          await tx
            .insert(providerCredentials)
            .values({
              workspaceId: session.workspaceId,
              provider: "GEMINI",
              capability: item.capability,
              model: item.model,
              encryptedSecret,
              secretLastFour: cleanKey.slice(-4),
              validatedAt: new Date(),
              disabledAt: null
            })
            .onConflictDoUpdate({
              target: [providerCredentials.workspaceId, providerCredentials.provider, providerCredentials.capability],
              set: {
                provider: "GEMINI",
                model: item.model,
                encryptedSecret,
                secretLastFour: cleanKey.slice(-4),
                validatedAt: new Date(),
                disabledAt: null,
                updatedAt: new Date()
              }
            });
        }
      });

      return NextResponse.json(
        {
          success: true,
          message: "Google AI Studio berhasil terhubung! Kuota dan fitur AI siap digunakan.",
          provider: "GEMINI",
          secretLastFour: cleanKey.slice(-4),
          validatedAt: new Date()
        },
        { status: 201 }
      );
    }

    // Case C: Explicit custom capability payload
    const input = fullCredentialSchema.parse(rawBody);
    const cleanApiKey = input.apiKey.trim();
    assertZarkPilotAccess(input.provider, input.capability, env);
    const adapter = getProviderAdapter(input.provider);
    const model = adapter.listModels().find((candidate) => candidate.id === input.model);
    if (!model || !model.capabilities.includes(input.capability)) {
      throw new Error("Model yang dipilih tidak mendukung capability ini.");
    }
    if (!(await adapter.validateCredential(cleanApiKey))) {
      throw new Error("Kunci API ditolak oleh penyedia AI.");
    }

    const encryptedSecret = encryptSecret(
      cleanApiKey,
      env.ENVELOPE_MASTER_KEY,
      `${session.workspaceId}:${input.provider}:${input.capability}`
    );

    const [credential] = await withTenant(db, session.workspaceId, async (tx) => {
      const now = new Date();
      await tx
        .update(providerCredentials)
        .set({ disabledAt: now, updatedAt: now })
        .where(
          and(
            eq(providerCredentials.workspaceId, session.workspaceId),
            eq(providerCredentials.capability, input.capability),
            ne(providerCredentials.provider, input.provider),
            isNull(providerCredentials.disabledAt)
          )
        );
      return tx
        .insert(providerCredentials)
        .values({
          workspaceId: session.workspaceId,
          provider: input.provider,
          capability: input.capability,
          model: input.model,
          encryptedSecret,
          secretLastFour: cleanApiKey.slice(-4),
          validatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [providerCredentials.workspaceId, providerCredentials.provider, providerCredentials.capability],
          set: {
            provider: input.provider,
            model: input.model,
            encryptedSecret,
            secretLastFour: cleanApiKey.slice(-4),
            validatedAt: new Date(),
            disabledAt: null,
            updatedAt: new Date()
          }
        })
        .returning({
          id: providerCredentials.id,
          provider: providerCredentials.provider,
          capability: providerCredentials.capability,
          model: providerCredentials.model,
          secretLastFour: providerCredentials.secretLastFour,
          validatedAt: providerCredentials.validatedAt
        });
    });

    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role !== "OWNER") throw new Error("Hanya owner workspace yang dapat menghapus kunci AI.");

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target");

    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);

    if (target === "zark-pilot") {
      const restoredProvider = await withTenant(db, session.workspaceId, async (tx) => {
        await tx
          .delete(providerCredentials)
          .where(
            and(
              eq(providerCredentials.workspaceId, session.workspaceId),
              eq(providerCredentials.provider, "ZARK"),
              eq(providerCredentials.capability, "IMAGE")
            )
          );

        const [fallback] = await tx
          .select({ id: providerCredentials.id, provider: providerCredentials.provider })
          .from(providerCredentials)
          .where(
            and(
              eq(providerCredentials.workspaceId, session.workspaceId),
              eq(providerCredentials.capability, "IMAGE"),
              ne(providerCredentials.provider, "ZARK")
            )
          )
          .orderBy(desc(providerCredentials.updatedAt))
          .limit(1);

        if (fallback) {
          await tx
            .update(providerCredentials)
            .set({ disabledAt: null, updatedAt: new Date() })
            .where(eq(providerCredentials.id, fallback.id));
        }
        return fallback?.provider ?? null;
      });

      return NextResponse.json({
        success: true,
        restoredProvider,
        message: restoredProvider
          ? `Zark Pilot dihentikan. Provider ${providerLabel(restoredProvider)} sebelumnya sudah diaktifkan kembali.`
          : "Zark Pilot dihentikan. Belum ada provider gambar sebelumnya untuk dipulihkan."
      });
    }

    if (target === "media") {
      await withTenant(db, session.workspaceId, (tx) =>
        tx
          .delete(providerCredentials)
          .where(
            and(
              eq(providerCredentials.workspaceId, session.workspaceId),
              inArray(providerCredentials.capability, ["IMAGE", "VIDEO"])
            )
          )
      );
      return NextResponse.json({
        success: true,
        message: "Kunci API untuk generasi aset media berhasil dihapus."
      });
    }

    if (target === "google-ai") {
      await withTenant(db, session.workspaceId, (tx) =>
        tx
          .delete(providerCredentials)
          .where(
            and(
              eq(providerCredentials.workspaceId, session.workspaceId),
              inArray(providerCredentials.capability, ["TEXT", "WEB_SEARCH"])
            )
          )
      );
      return NextResponse.json({
        success: true,
        message: "Kunci Google AI Studio berhasil dihapus."
      });
    }

    // Default: delete all
    await withTenant(db, session.workspaceId, (tx) =>
      tx
        .delete(providerCredentials)
        .where(eq(providerCredentials.workspaceId, session.workspaceId))
    );

    return NextResponse.json({
      success: true,
      message: "Kunci API berhasil dihapus dari workspace."
    });
  } catch (error) {
    return apiError(error);
  }
}
