import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { brandProfiles, createDatabase, entitlements, memberships, users, workspaces } from "@routie/db";
import type { WorkspaceRole } from "@routie/domain";
import { createSessionToken } from "@routie/security";
import { SESSION_COOKIE } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { GOOGLE_LOGIN_OAUTH_COOKIE } from "@/lib/pkce";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const searchParams = request.nextUrl.searchParams;

  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(`Google Sign-In Dibatalkan: ${errorDesc || errorParam}`)}`, env.APP_URL)
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=Parameter+otentikasi+Google+tidak+lengkap.", env.APP_URL)
    );
  }

  // Retrieve cookie state
  const cookieVal = request.cookies.get(GOOGLE_LOGIN_OAUTH_COOKIE)?.value;
  if (!cookieVal) {
    return NextResponse.redirect(
      new URL("/login?error=Sesi+login+Google+telah+kedaluwarsa.+Silakan+coba+lagi.", env.APP_URL)
    );
  }

  let oauthData: { state: string; codeVerifier: string; redirectUri: string };
  try {
    oauthData = JSON.parse(cookieVal);
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=Data+sesi+Google+rusak.+Silakan+coba+lagi.", env.APP_URL)
    );
  }

  if (oauthData.state !== state) {
    return NextResponse.redirect(
      new URL("/login?error=Validasi+keamanan+OAuth+state+mismatch.", env.APP_URL)
    );
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/login?error=Google+OAuth+credentials+missing+on+server.", env.APP_URL)
    );
  }

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: oauthData.redirectUri,
    grant_type: "authorization_code",
    code_verifier: oauthData.codeVerifier
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString()
  });

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    const errorMsg = tokenData.error_description || tokenData.error || "Gagal menukar token dengan Google";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, env.APP_URL)
    );
  }

  // Fetch Google User Profile
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!userRes.ok) {
    return NextResponse.redirect(
      new URL("/login?error=Gagal+mengambil+profil+Google+pengguna.", env.APP_URL)
    );
  }

  const userInfo = (await userRes.json()) as GoogleUserInfo;
  const normalizedEmail = userInfo.email.toLowerCase().trim();
  const displayName = userInfo.name || normalizedEmail.split("@")[0] || "User";

  try {
    const db = createDatabase(env.DATABASE_INTEGRATION_URL ?? env.DATABASE_URL);

    // Find or provision user & workspace in database
    const { sessionClaims, isNewUser } = await db.transaction(async (tx) => {
    // 1. Atomic upsert user
    const [user] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        name: displayName
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: displayName,
          updatedAt: new Date()
        }
      })
      .returning();

    if (!user) throw new Error("Gagal memproses data pengguna Google.");

    // 2. Check if user already has a membership in a workspace
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    let targetWorkspaceId: string;
    let userRole: WorkspaceRole = "OWNER";
    let isBrandNew = false;

    if (membership) {
      targetWorkspaceId = membership.workspaceId;
      userRole = membership.role;
    } else {
      isBrandNew = true;
      const [newWs] = await tx
        .insert(workspaces)
        .values({
          externalCustomerId: `cust_${randomBytes(8).toString("hex")}`,
          name: `${displayName}'s Workspace`
        })
        .returning();

      if (!newWs) throw new Error("Gagal membuat workspace baru.");
      targetWorkspaceId = newWs.id;

      await tx.insert(memberships).values({
        workspaceId: targetWorkspaceId,
        userId: user.id,
        role: "OWNER"
      });

      await tx.insert(entitlements).values({
        workspaceId: targetWorkspaceId,
        status: "ACTIVE"
      });
    }

    return {
      sessionClaims: {
        sub: user.id,
        workspaceId: targetWorkspaceId,
        role: userRole,
        email: normalizedEmail
      },
      isNewUser: isBrandNew
    };
    });

    // Create JWT session token
    const sessionToken = await createSessionToken(sessionClaims, env.SESSION_SECRET);

    // Check if brand identity profile exists for workspace
    const [profile] = await db
      .select({ id: brandProfiles.id })
      .from(brandProfiles)
      .where(eq(brandProfiles.workspaceId, sessionClaims.workspaceId))
      .limit(1);

    const destination = (!profile || isNewUser) ? "/onboarding" : "/dashboard";

    const response = NextResponse.redirect(new URL(destination, env.APP_URL));

    // Set secure HTTP-only session cookie
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    // Clear OAuth cookie
    response.cookies.delete(GOOGLE_LOGIN_OAUTH_COOKIE);

    return response;
  } catch (error) {
    console.error("[google-callback] Failed to provision session:", error);
    return NextResponse.redirect(
      new URL("/login?error=Login+Google+gagal+diproses.+Pastikan+database+aktif%2C+lalu+coba+lagi.", env.APP_URL)
    );
  }
}
