import { NextRequest, NextResponse } from "next/server";
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

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role === "APPROVER") throw new Error("Approver cannot start paid media generation");
    const { id } = await context.params;
    const db = createDatabase(serverEnv().DATABASE_URL);
    const render = await withTenant(db, session.workspaceId, async (tx) => {
      const [row] = await tx
        .select({ concept: contentConcepts, profile: brandProfiles })
        .from(contentConcepts)
        .innerJoin(brandProfiles, eq(brandProfiles.workspaceId, contentConcepts.workspaceId))
        .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)))
        .limit(1);
      if (!row) throw new Error("Content concept not found");
      if (!["IDEA_APPROVED", "FAILED"].includes(row.concept.state)) throw new Error(`Media cannot be generated from state ${row.concept.state}`);
      const [credential] = await tx
        .select()
        .from(providerCredentials)
        .where(and(
          eq(providerCredentials.workspaceId, session.workspaceId),
          eq(providerCredentials.capability, "IMAGE"),
          isNull(providerCredentials.disabledAt)
        ))
        .limit(1);
      if (!credential) throw new Error("Configure and validate an IMAGE provider in Settings first");
      const prompt = buildImagePrompt({
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
      await tx.insert(auditEvents).values({
        workspaceId: session.workspaceId,
        actorId: session.sub,
        action: "CONTENT_MEDIA_QUEUED",
        entityType: "content_concept",
        entityId: id,
        after: { provider: credential.provider, model: credential.model, version: row.concept.version }
      });
      return { credential, concept: row.concept, prompt };
    });

    const jobId = `media-${id}-v${render.concept.version}${render.concept.state === "FAILED" ? `-retry-${Date.now()}` : ""}`;
    await generationQueue().add("generate-concept-media", {
      workspaceId: session.workspaceId,
      credentialId: render.credential.id,
      request: {
        capability: "IMAGE",
        model: render.credential.model,
        prompt: render.prompt,
        aspectRatio: "1:1",
        idempotencyKey: `concept-media:${id}:v${render.concept.version}`
      },
      target: { kind: "CONCEPT_MEDIA", conceptId: id }
    }, { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 } });
    return NextResponse.json({ queued: true, state: "GENERATING", jobId });
  } catch (error) {
    return apiError(error);
  }
}
