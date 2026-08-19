import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auditEvents, brandProfiles, createDatabase, withTenant, workspaces } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const profileSchema = z.object({
  businessName: z.string().min(2).max(120),
  tagline: z.string().max(300).default(""),
  brief: z.string().min(10).max(10_000).default(""),
  brandPersona: z.string().max(10_000).default(""),
  niche: z.string().max(100).default(""),
  websiteUrl: z.string().max(500).default(""),
  targetAudience: z.string().max(2_000).default(""),
  targetAgeMin: z.number().int().min(13).max(100).default(18),
  targetAgeMax: z.number().int().min(13).max(100).default(45),
  targetGender: z.string().default("ALL"),
  targetLocations: z.array(z.string().max(100)).max(20).default([]),
  tone: z.string().min(2).max(500).default("Professional & Friendly"),
  prohibitedClaims: z.array(z.string().max(300)).max(50).default([]),
  callsToAction: z.array(z.string().max(300)).max(20).default([]),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(12).default([]),
  contentPillars: z.array(z.object({ name: z.string().min(1).max(80), percentage: z.number().int().min(0).max(100) })).min(1).max(10)
}).refine((value) => value.contentPillars.reduce((total, pillar) => total + pillar.percentage, 0) === 100, {
  message: "Content pillar percentages must total 100",
  path: ["contentPillars"]
});

export async function GET() {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);
    const profile = await withTenant(db, session.workspaceId, async (tx) => {
      const [record] = await tx.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, session.workspaceId)).limit(1);
      return record ?? null;
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role !== "OWNER" && session.role !== "EDITOR") throw new Error("Role cannot edit the brand profile");
    const input = profileSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);
    const profile = await withTenant(db, session.workspaceId, async (tx) => {
      const [before] = await tx.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, session.workspaceId)).limit(1);
      const [saved] = await tx.insert(brandProfiles)
        .values({ workspaceId: session.workspaceId, ...input, onboardingCompletedAt: new Date() })
        .onConflictDoUpdate({
          target: brandProfiles.workspaceId,
          set: { ...input, onboardingCompletedAt: new Date(), updatedAt: new Date() }
        })
        .returning();
      await tx.update(workspaces).set({ name: input.businessName, updatedAt: new Date() }).where(eq(workspaces.id, session.workspaceId));
      await tx.insert(auditEvents).values({
        workspaceId: session.workspaceId,
        actorId: session.sub,
        action: before ? "BRAND_PROFILE_UPDATED" : "BRAND_PROFILE_CREATED",
        entityType: "brand_profile",
        entityId: saved!.id,
        before: before ? { businessName: before.businessName, targetAudience: before.targetAudience, tone: before.tone } : null,
        after: { businessName: saved!.businessName, targetAudience: saved!.targetAudience, tone: saved!.tone }
      });
      return saved!;
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}
