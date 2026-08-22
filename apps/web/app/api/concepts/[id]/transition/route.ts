import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  approvals,
  auditEvents,
  brandProfiles,
  calendarSlots,
  channelVariants,
  contentConcepts,
  createDatabase,
  providerCredentials
} from "@routie/db";
import { withTenant } from "@routie/db";
import { assertTransition, contentStateSchema } from "@routie/domain";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { buildImagePrompt } from "@/lib/media-generation";
import { generationQueue, publishingQueue } from "@/lib/queue";
import { preparePublishJobs } from "@/lib/publish-scheduling";

const transitionSchema = z.object({
  to: contentStateSchema,
  reason: z.string().max(2_000).optional(),
  expectedVersion: z.number().int().positive().optional(),
  channelDecisions: z.array(z.object({ variantId: z.uuid(), approved: z.boolean(), reason: z.string().max(1_000).optional() })).optional()
}).superRefine((value, context) => {
  if (value.to === "REJECTED" && (!value.reason || value.reason.trim().length < 3)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Alasan penolakan minimal 3 karakter" });
  }
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    const { id } = await context.params;
    const input = transitionSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);
    const queued = await withTenant(db, session.workspaceId, async (tx) => {
      const [concept] = await tx
        .select({ concept: contentConcepts, scheduledFor: calendarSlots.scheduledFor })
        .from(contentConcepts)
        .innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId))
        .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)))
        .limit(1);
      if (!concept) throw new Error("Content concept not found");
      if (input.expectedVersion !== undefined && input.expectedVersion !== concept.concept.version) {
        throw new Error("Content was updated by someone else; refresh before deciding");
      }
      assertTransition(concept.concept.state, input.to, session.role);

      if (input.channelDecisions) {
        for (const decision of input.channelDecisions) {
          await tx
            .update(channelVariants)
            .set(
              decision.approved
                ? { approvedAt: new Date(), approvedBy: session.sub, rejectedAt: null, rejectionReason: null, updatedAt: new Date() }
                : { approvedAt: null, approvedBy: null, rejectedAt: new Date(), rejectionReason: decision.reason ?? "Rejected by approver", updatedAt: new Date() }
            )
            .where(and(eq(channelVariants.id, decision.variantId), eq(channelVariants.conceptId, id), eq(channelVariants.workspaceId, session.workspaceId)));
        }
      } else if (input.to === "APPROVED") {
        await tx
          .update(channelVariants)
          .set({ approvedAt: new Date(), approvedBy: session.sub, updatedAt: new Date() })
          .where(and(eq(channelVariants.conceptId, id), eq(channelVariants.workspaceId, session.workspaceId), isNull(channelVariants.rejectedAt)));
      }

      if (["IDEA_APPROVED", "APPROVED", "REJECTED"].includes(input.to)) {
        const ideaStage = concept.concept.state === "IDEA_REVIEW";
        await tx.insert(approvals).values({
          workspaceId: session.workspaceId,
          conceptId: id,
          stage: ideaStage ? "IDEA" : "FINAL",
          decision: input.to === "REJECTED" ? "REJECTED" : "APPROVED",
          reason: input.reason,
          actorId: session.sub,
          entityVersion: concept.concept.version
        });
      }

      let targetState = (input.to === "APPROVED" && concept.scheduledFor) ? "SCHEDULED" : input.to;
      const nextVersion = concept.concept.version + 1;

      let preparedPublishJobs: Awaited<ReturnType<typeof preparePublishJobs>> = [];
      if (targetState === "SCHEDULED") {
        if (!concept.scheduledFor) throw new Error("Calendar slot has no publish timestamp");
        preparedPublishJobs = await preparePublishJobs(tx, {
          workspaceId: session.workspaceId,
          conceptId: id,
          scheduledFor: concept.scheduledFor
        });
        if (preparedPublishJobs.length === 0 || !preparedPublishJobs.some((job) => job.queued)) {
          targetState = "HELD";
        }
      }

      const heldReason = targetState === "HELD"
        ? (preparedPublishJobs.length > 0
            ? "Hubungkan akun sosial media tujuan agar konten dapat diterbitkan."
            : input.reason)
        : null;
      await tx.update(contentConcepts).set({ state: targetState, version: nextVersion, heldReason, updatedAt: new Date() }).where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)));
      await tx.insert(auditEvents).values({
        workspaceId: session.workspaceId,
        actorId: session.sub,
        action: "CONTENT_STATE_CHANGED",
        entityType: "content_concept",
        entityId: id,
        before: { state: concept.concept.state },
        after: { state: targetState, reason: heldReason ?? input.reason }
      });

      let finalState = targetState;
      let mediaGeneration: null | { credentialId: string; model: string; prompt: string; version: number } = null;
      if (targetState === "IDEA_APPROVED") {
        const [[credential], [profile]] = await Promise.all([
          tx.select().from(providerCredentials).where(and(eq(providerCredentials.workspaceId, session.workspaceId), eq(providerCredentials.capability, "IMAGE"), isNull(providerCredentials.disabledAt))).limit(1),
          tx.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, session.workspaceId)).limit(1)
        ]);
        if (credential && profile) {
          finalState = "GENERATING";
          mediaGeneration = {
            credentialId: credential.id,
            model: credential.model,
            version: nextVersion,
            prompt: buildImagePrompt({
              ...profile,
              businessName: profile.businessName,
              brief: profile.brief,
              targetAudience: profile.targetAudience,
              tone: profile.tone,
              colors: profile.colors,
              prohibitedClaims: profile.prohibitedClaims,
              topic: concept.concept.topic,
              hook: concept.concept.hook,
              outline: concept.concept.outline,
              contentPillar: concept.concept.contentPillar
            })
          };
          await tx
            .update(contentConcepts)
            .set({ state: "GENERATING", heldReason: null, updatedAt: new Date() })
            .where(and(eq(contentConcepts.id, id), eq(contentConcepts.workspaceId, session.workspaceId)));
          await tx.insert(auditEvents).values({
            workspaceId: session.workspaceId,
            actorId: session.sub,
            action: "CONTENT_MEDIA_QUEUED",
            entityType: "content_concept",
            entityId: id,
            after: { provider: credential.provider, model: credential.model, version: nextVersion, state: "GENERATING" }
          });
        }
      }

      return { publishJobs: preparedPublishJobs, mediaGeneration, finalState };
    });

    const queue = publishingQueue();
    await Promise.all(
      queued.publishJobs.filter((job) => job.queued).map((job) =>
        queue.add("publish", { workspaceId: session.workspaceId, publishJobId: job.id }, { jobId: job.id, delay: Math.max(0, job.scheduledFor.getTime() - Date.now()), attempts: 3, backoff: { type: "exponential", delay: 5_000 } })
      )
    );
    if (queued.mediaGeneration) {
      const media = queued.mediaGeneration;
      await generationQueue().add("generate-concept-media", {
        workspaceId: session.workspaceId,
        credentialId: media.credentialId,
        request: {
          capability: "IMAGE",
          model: media.model,
          prompt: media.prompt,
          aspectRatio: "1:1",
          idempotencyKey: `concept-media:${id}:v${media.version}`
        },
        target: { kind: "CONCEPT_MEDIA", conceptId: id }
      }, { jobId: `media-${id}-v${media.version}`, attempts: 2, backoff: { type: "exponential", delay: 15_000 } });
    }
    return NextResponse.json({ state: queued.finalState, publishJobsQueued: queued.publishJobs.length, mediaQueued: Boolean(queued.mediaGeneration) });
  } catch (error) {
    return apiError(error);
  }
}
