import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import {
  auditEvents,
  brandProfiles,
  contentConcepts,
  createDatabase,
  providerCredentials,
  withTenant
} from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { buildImagePrompt } from "@/lib/media-generation";
import { generationQueue } from "@/lib/queue";

const reviseSchema = z.object({
  instructions: z.string().min(3).max(1000)
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approver tidak dapat meminta revisi render AI.");

    const { id } = await context.params;
    const { instructions } = reviseSchema.parse(await request.json());

    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);

    const render = await withTenant(db, session.workspaceId, async (tx) => {
      const [row] = await tx
        .select({ concept: contentConcepts, profile: brandProfiles })
        .from(contentConcepts)
        .innerJoin(brandProfiles, eq(brandProfiles.workspaceId, contentConcepts.workspaceId))
        .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)))
        .limit(1);

      if (!row) throw new Error("Konsep konten tidak ditemukan.");
      if (!["FINAL_REVIEW", "HELD", "FAILED", "IDEA_APPROVED"].includes(row.concept.state)) {
        throw new Error(`Konten dalam status ${row.concept.state} tidak dapat direvisi media.`);
      }

      const [credential] = await tx
        .select()
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.workspaceId, session.workspaceId),
            eq(providerCredentials.capability, "IMAGE"),
            isNull(providerCredentials.disabledAt)
          )
        )
        .limit(1);

      if (!credential) {
        throw new Error("Hubungkan kunci API Gambar (OpenAI / Google) di Pengaturan sebelum meminta revisi media.");
      }

      const newVersion = row.concept.version + 1;

      // Update state to GENERATING
      await tx
        .update(contentConcepts)
        .set({
          state: "GENERATING",
          heldReason: `Revisi: ${instructions}`,
          version: newVersion,
          updatedAt: new Date()
        })
        .where(eq(contentConcepts.id, id));

      const basePrompt = buildImagePrompt({
        ...row.profile,
        businessName: row.profile.businessName,
        brief: row.profile.brief,
        targetAudience: row.profile.targetAudience,
        tone: row.profile.tone,
        colors: row.profile.colors,
        prohibitedClaims: row.profile.prohibitedClaims,
        topic: row.concept.topic,
        hook: row.concept.hook,
        outline: row.concept.outline,
        contentPillar: row.concept.contentPillar
      });

      const promptWithRevision = `${basePrompt}\n\n[REVISION INSTRUCTIONS / PERUBAHAN YANG DIMINTA USER]:\n${instructions}`;

      await tx.insert(auditEvents).values({
        workspaceId: session.workspaceId,
        actorId: session.sub,
        action: "CONTENT_REVISION_REQUESTED",
        entityType: "content_concept",
        entityId: id,
        after: { instructions, newVersion, provider: credential.provider }
      });

      return { credential, concept: row.concept, prompt: promptWithRevision, newVersion };
    });

    const jobId = `media-${id}-v${render.newVersion}-${Date.now()}`;
    await generationQueue().add(
      "generate-concept-media",
      {
        workspaceId: session.workspaceId,
        credentialId: render.credential.id,
        request: {
          capability: "IMAGE",
          model: render.credential.model,
          prompt: render.prompt,
          aspectRatio: "1:1",
          idempotencyKey: `concept-media:${id}:v${render.newVersion}`
        },
        target: { kind: "CONCEPT_MEDIA", conceptId: id }
      },
      { jobId, attempts: 2, backoff: { type: "exponential", delay: 15_000 } }
    );

    return NextResponse.json({
      success: true,
      message: "Instruksi revisi diterima. AI sedang men-generate ulang visual konten.",
      state: "GENERATING",
      jobId
    });
  } catch (error) {
    return apiError(error);
  }
}
