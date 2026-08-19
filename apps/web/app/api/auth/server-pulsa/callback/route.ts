import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase, entitlements, memberships, users, workspaces } from "@routie/db";
import { evaluateEntitlement } from "@routie/domain";
import { createSessionToken } from "@routie/security";
import { SESSION_COOKIE } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const exchangeResponseSchema = z.object({
  customer: z.object({ id: z.string().min(1), brandName: z.string().min(1) }),
  user: z.object({ id: z.string().min(1), email: z.email(), name: z.string().min(1) }),
  entitlement: z.object({ active: z.boolean(), currentPeriodEnd: z.iso.datetime().nullable() })
});

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Missing one-time SSO code");
    const env = serverEnv();
    const response = await fetch(`${env.SERVER_PULSA_BASE_URL}/internal/routie/sso/exchange`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SERVER_PULSA_SERVICE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error("Server Pulsa rejected or expired the SSO code");
    const identity = exchangeResponseSchema.parse(await response.json());
    const periodEnd = identity.entitlement.currentPeriodEnd ? new Date(identity.entitlement.currentPeriodEnd) : null;
    const access = evaluateEntitlement(identity.entitlement.active, periodEnd);
    if (!access.canRead) throw new Error(`Server Pulsa subscription is ${access.status.toLowerCase()}`);
    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);
    const session = await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ externalCustomerId: identity.customer.id, name: identity.customer.brandName })
        .onConflictDoUpdate({ target: workspaces.externalCustomerId, set: { name: identity.customer.brandName, updatedAt: new Date() } })
        .returning();
      const [user] = await tx
        .insert(users)
        .values({ externalCustomerId: identity.user.id, email: identity.user.email.toLowerCase(), name: identity.user.name })
        .onConflictDoUpdate({ target: users.externalCustomerId, set: { email: identity.user.email.toLowerCase(), name: identity.user.name, updatedAt: new Date() } })
        .returning();
      await tx
        .insert(memberships)
        .values({ workspaceId: workspace!.id, userId: user!.id, role: "OWNER" })
        .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role: "OWNER" } });
      await tx
        .insert(entitlements)
        .values({
          workspaceId: workspace!.id,
          status: access.status,
          currentPeriodEnd: periodEnd,
          expiredAt: identity.entitlement.active ? null : periodEnd,
          graceEndsAt: !identity.entitlement.active && periodEnd ? new Date(periodEnd.getTime() + 7 * 86_400_000) : null,
          purgeAt: !identity.entitlement.active && periodEnd ? new Date(periodEnd.getTime() + 30 * 86_400_000) : null
        })
        .onConflictDoUpdate({ target: entitlements.workspaceId, set: {
          status: access.status,
          expiredAt: identity.entitlement.active ? null : periodEnd,
          graceEndsAt: !identity.entitlement.active && periodEnd ? new Date(periodEnd.getTime() + 7 * 86_400_000) : null,
          purgeAt: !identity.entitlement.active && periodEnd ? new Date(periodEnd.getTime() + 30 * 86_400_000) : null,
          currentPeriodEnd: periodEnd,
          updatedAt: new Date()
        } });
      return { sub: user!.id, workspaceId: workspace!.id, role: "OWNER" as const, email: user!.email };
    });
    const token = await createSessionToken(session, env.SESSION_SECRET);
    const redirect = NextResponse.redirect(new URL("/dashboard", env.APP_URL));
    redirect.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
    return redirect;
  } catch (error) {
    return apiError(error);
  }
}
