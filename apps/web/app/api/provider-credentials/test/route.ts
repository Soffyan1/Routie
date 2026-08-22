import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { createDatabase, providerCredentials, withTenant } from "@routie/db";
import { getProviderAdapter, isZarkPilotEnabled } from "@routie/providers";
import { decryptSecret } from "@routie/security";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);

    const body = (await request.json().catch(() => ({}))) as {
      apiKey?: string;
      provider?: "GEMINI" | "OPENAI" | "ANTHROPIC" | "ZARK";
      target?: "GOOGLE_AI" | "MEDIA_ASSET";
    };
    const env = serverEnv();
    const provider = body.provider || "GEMINI";
    if (provider === "ZARK" && !isZarkPilotEnabled(env)) {
      return NextResponse.json(
        { success: false, message: "Zark Pilot sedang dinonaktifkan di environment ini." },
        { status: 404 }
      );
    }
    const adapter = getProviderAdapter(provider);

    // Case 1: Test key provided directly in request body (e.g. from input before saving)
    if (body.apiKey && typeof body.apiKey === "string" && body.apiKey.trim().length > 0) {
      const cleanKey = body.apiKey.trim();
      const isValid = await adapter.validateCredential(cleanKey);

      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            message: `Kunci API ${provider === "OPENAI" ? "OpenAI" : provider === "ZARK" ? "Zark" : "Google AI"} tidak valid atau ditolak. Pastikan kunci disalin dengan benar.`
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Koneksi ke ${provider === "OPENAI" ? "OpenAI" : provider === "ZARK" ? "Zark" : "Google AI"} berhasil! Kunci API aktif dan valid.`
      });
    }

    // Case 2: Test stored key in database
    const db = createDatabase(env.DATABASE_URL);
    const targetCapability = body.target === "MEDIA_ASSET" ? "IMAGE" : "TEXT";

    const stored = await withTenant(db, session.workspaceId, (tx) =>
      tx
        .select()
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.workspaceId, session.workspaceId),
            eq(providerCredentials.capability, targetCapability),
            isNull(providerCredentials.disabledAt)
          )
        )
        .limit(1)
    );

    if (!stored[0]) {
      return NextResponse.json(
        {
          success: false,
          message: `Belum ada kunci API ${body.target === "MEDIA_ASSET" ? "generasi aset media" : "Google AI"} yang tersimpan di workspace ini.`
        },
        { status: 404 }
      );
    }

    if (stored[0].provider === "ZARK" && !isZarkPilotEnabled(env)) {
      return NextResponse.json(
        { success: false, message: "Zark Pilot sedang dinonaktifkan di environment ini." },
        { status: 404 }
      );
    }

    try {
      const storedAdapter = getProviderAdapter(stored[0].provider);
      const decryptedKey = decryptSecret(
        stored[0].encryptedSecret,
        env.ENVELOPE_MASTER_KEY,
        `${session.workspaceId}:${stored[0].provider}:${stored[0].capability}`
      );

      const isValid = await storedAdapter.validateCredential(decryptedKey);
      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            message: `Kunci API tersimpan (${stored[0].provider}) tidak dapat memvalidasi request. Kemungkinan kunci telah dicabut atau kuota habis.`
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Koneksi ke ${stored[0].provider} aktif & berfungsi dengan baik.`
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Gagal membuka enkripsi kunci tersimpan."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
