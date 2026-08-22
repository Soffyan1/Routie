// Temporary script to force‑refresh the YouTube access token for the current workspace
import "dotenv/config";
import { createDatabase, socialConnections, withTenant } from "@routie/db";
import { decryptSecret, encryptSecret } from "@routie/security";
import { eq } from "drizzle-orm";

const workspaceId = process.env.WORKSPACE_ID; // set this env var before running
if (!workspaceId) throw new Error("WORKSPACE_ID env var required");

const env = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  ENVELOPE_MASTER_KEY: process.env.ENVELOPE_MASTER_KEY,
};
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ENVELOPE_MASTER_KEY) {
  throw new Error("Missing Google OAuth credentials or ENVELOPE_MASTER_KEY");
}

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  // fetch the YouTube connection for the workspace
  const connection = await withTenant(db, workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.workspaceId, workspaceId))
      .where(eq(socialConnections.channel, "YOUTUBE"))
      .limit(1);
    return rows[0];
  });

  if (!connection) {
    console.log("No YouTube connection found for this workspace");
    return;
  }

  if (!connection.encryptedRefreshToken) {
    console.log("Refresh token not stored – cannot refresh");
    return;
  }

  const masterKey = env.ENVELOPE_MASTER_KEY;
  const refreshToken = decryptSecret(
    connection.encryptedRefreshToken,
    masterKey,
    `${workspaceId}:YOUTUBE:refresh-token`
  );

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || tokenData.error) {
    console.error("Refresh failed:", tokenData.error_description || tokenData.error);
    return;
  }
  const newAccess = tokenData.access_token!;
  const expiresIn = tokenData.expires_in ?? 3600;

  const encryptedAccess = encryptSecret(
    newAccess,
    masterKey,
    `${workspaceId}:YOUTUBE:access-token`
  );

  await withTenant(db, workspaceId, async (tx) => {
    await tx
      .update(socialConnections)
      .set({
        encryptedAccessToken: encryptedAccess,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(socialConnections.id, connection.id));
  });

  console.log("YouTube access token refreshed successfully. New expiry:", new Date(Date.now() + expiresIn * 1000).toISOString());
}

main().catch((e) => console.error(e));
