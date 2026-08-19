import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, magicLinks, memberships, workspaces, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { requireActiveEntitlement } from "@/lib/entitlement";
import { sendMagicLink } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const invitationSchema = z.object({ email: z.email(), role: z.enum(["EDITOR", "APPROVER"]) });

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireActiveEntitlement(session.workspaceId);
    if (session.role !== "OWNER") throw new Error("Only the owner can invite team members");
    const input = invitationSchema.parse(await request.json());
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);
    const [[membershipCount], [workspace]] = await withTenant(db, session.workspaceId, (tx) => Promise.all([
      tx.select({ value: count() }).from(memberships).where(eq(memberships.workspaceId, session.workspaceId)),
      tx.select({ maxMembers: workspaces.maxMembers }).from(workspaces).where(eq(workspaces.id, session.workspaceId)).limit(1)
    ]));
    if (!workspace || (membershipCount?.value ?? 0) >= workspace.maxMembers) throw new Error("Workspace member limit reached");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await withTenant(db, session.workspaceId, (tx) => tx.insert(magicLinks).values({
      workspaceId: session.workspaceId,
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60_000)
    }));
    const url = new URL("/api/auth/magic-link", env.APP_URL);
    url.searchParams.set("token", token);
    await sendMagicLink(input.email, url.toString());
    return NextResponse.json({ invited: true, ...(env.NODE_ENV !== "production" ? { developmentUrl: url.toString() } : {}) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
