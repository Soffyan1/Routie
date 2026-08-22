import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, entitlements, magicLinks, memberships, users, workspaces } from "@routie/db";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { sendMagicLink } from "@/lib/email";

const provisionSchema = z.object({
  adminSecret: z.string().min(1),
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1),
  brandName: z.string().min(1),
  sendWelcomeEmail: z.boolean().default(true)
});

export async function POST(request: NextRequest) {
  try {
    const input = provisionSchema.parse(await request.json());
    const env = serverEnv();

    // Verify admin authorization
    const validSecret = env.SERVER_PULSA_SERVICE_TOKEN || env.SESSION_SECRET;
    if (input.adminSecret !== validSecret) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Kunci rahasia admin tidak valid." }, { status: 401 });
    }

    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);

    const result = await db.transaction(async (tx) => {
      // 1. Find or create user
      let [user] = await tx
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        const [newUser] = await tx
          .insert(users)
          .values({
            email: input.email,
            name: input.name
          })
          .onConflictDoUpdate({ target: users.email, set: { name: input.name, updatedAt: new Date() } })
          .returning();
        user = newUser;
      }

      if (!user) {
        throw new Error("Gagal membuat data pengguna.");
      }

      // 2. Create workspace
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          externalCustomerId: `r1_ws_${randomBytes(8).toString("hex")}`,
          name: input.brandName
        })
        .returning();

      if (!workspace) {
        throw new Error("Gagal membuat workspace.");
      }

      // 3. Create active entitlement
      await tx
        .insert(entitlements)
        .values({
          workspaceId: workspace.id,
          status: "ACTIVE"
        });

      // 4. Create owner membership
      await tx
        .insert(memberships)
        .values({
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER"
        });

      // 5. Generate magic link token for instant access
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for initial invite

      await tx.insert(magicLinks).values({
        workspaceId: workspace.id,
        email: input.email,
        tokenHash,
        role: "OWNER",
        expiresAt
      });

      const magicLinkUrl = `${env.APP_URL}/api/auth/magic-link?token=${rawToken}`;

      return {
        userId: user.id,
        workspaceId: workspace.id,
        magicLinkUrl
      };
    });

    // 6. Send welcome email if requested
    if (input.sendWelcomeEmail) {
      await sendMagicLink(input.email, result.magicLinkUrl, input.name);
    }

    return NextResponse.json({
      success: true,
      message: `Akun Routie untuk ${input.email} (${input.brandName}) berhasil didaftarkan.`,
      ...result
    });
  } catch (error) {
    return apiError(error);
  }
}
