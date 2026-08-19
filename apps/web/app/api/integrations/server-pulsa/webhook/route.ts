import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, entitlements, publishJobs, webhookEvents, workspaces } from "@routie/db";
import { verifyWebhookSignature } from "@routie/security";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const eventSchema = z.object({
  type: z.enum(["subscription.activated", "subscription.renewed", "subscription.canceled", "subscription.expired"]),
  customerId: z.string().min(1),
  occurredAt: z.iso.datetime(),
  currentPeriodEnd: z.iso.datetime().nullable().optional(),
  version: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const eventId = request.headers.get("x-routie-event-id") ?? "";
    const timestamp = request.headers.get("x-routie-timestamp") ?? "";
    const signature = request.headers.get("x-routie-signature") ?? "";
    const env = serverEnv();
    if (!eventId || !verifyWebhookSignature(env.SERVER_PULSA_WEBHOOK_SECRET, { eventId, timestamp, signature }, rawBody)) {
      return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
    }
    const event = eventSchema.parse(JSON.parse(rawBody));
    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);
    const result = await db.transaction(async (tx) => {
      const [duplicate] = await tx.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).limit(1);
      if (duplicate) return "duplicate";
      const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.externalCustomerId, event.customerId)).limit(1);
      await tx.insert(webhookEvents).values({
        eventId,
        source: "server-pulsa",
        eventType: event.type,
        payloadHash: createHash("sha256").update(rawBody).digest("hex")
      });
      if (!workspace) return "workspace-not-created";
      if (event.type === "subscription.activated" || event.type === "subscription.renewed") {
        await tx
          .update(entitlements)
          .set({ status: "ACTIVE", expiredAt: null, graceEndsAt: null, purgeAt: null, currentPeriodEnd: event.currentPeriodEnd ? new Date(event.currentPeriodEnd) : null, sourceVersion: event.version, updatedAt: new Date() })
          .where(eq(entitlements.workspaceId, workspace.id));
        return "activated";
      }
      const expiredAt = new Date(event.occurredAt);
      await tx
        .update(entitlements)
        .set({ status: "GRACE", expiredAt, graceEndsAt: new Date(expiredAt.getTime() + 7 * 86_400_000), purgeAt: new Date(expiredAt.getTime() + 30 * 86_400_000), sourceVersion: event.version, updatedAt: new Date() })
        .where(eq(entitlements.workspaceId, workspace.id));
      await tx.update(publishJobs).set({ status: "HELD", heldReason: "ENTITLEMENT_GRACE", updatedAt: new Date() }).where(eq(publishJobs.workspaceId, workspace.id));
      return "grace";
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    return apiError(error);
  }
}
