import "dotenv/config";
import fs from "node:fs";
import { createDatabase, publishJobs, socialConnections, withTenant } from "@routie/db";
import { eq } from "drizzle-orm";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000002";
const VIDEO_PATH = "/tmp/sample_short.mp4";

async function main() {
  console.log("=== 1. Checking YouTube Connection in Database ===");
  const db = createDatabase(process.env.DATABASE_URL!);
  const connection = await withTenant(db, WORKSPACE_ID, async (tx) => {
    const rows = await tx
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.workspaceId, WORKSPACE_ID))
      .where(eq(socialConnections.channel, "YOUTUBE"))
      .limit(1);
    return rows[0];
  });

  if (!connection) {
    throw new Error("No connected YouTube account found in database!");
  }
  console.log(`✅ Connected YouTube account: ${connection.accountName} (ID: ${connection.externalAccountId})`);
  console.log(`   Token expires at: ${connection.tokenExpiresAt}`);
  console.log(`   Refresh token present: ${Boolean(connection.encryptedRefreshToken)}`);

  console.log("\n=== 2. Reading Sample Video ===");
  if (!fs.existsSync(VIDEO_PATH)) {
    throw new Error(`Video file ${VIDEO_PATH} not found`);
  }
  const videoBuffer = fs.readFileSync(VIDEO_PATH);
  const videoSize = videoBuffer.byteLength;
  console.log(`✅ Loaded video: ${videoSize} bytes (${(videoSize / (1024 * 1024)).toFixed(2)} MB)`);

  console.log("\n=== 3. Requesting Presigned Upload URL ===");
  const uploadUrlRes = await fetch(`${APP_URL}/api/assets/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "sample-short.mp4",
      contentType: "video/mp4",
      sizeBytes: videoSize
    })
  });
  const uploadUrlData = await uploadUrlRes.json();
  if (!uploadUrlRes.ok || !uploadUrlData.uploadUrl) {
    throw new Error(`Failed to get upload URL: ${JSON.stringify(uploadUrlData)}`);
  }
  console.log(`✅ Got upload URL for key: ${uploadUrlData.objectKey}`);

  console.log("\n=== 4. Uploading Video to Storage (MinIO) ===");
  const putRes = await fetch(uploadUrlData.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: videoBuffer
  });
  if (!putRes.ok) {
    throw new Error(`Failed to upload to S3/MinIO: ${putRes.statusText}`);
  }
  console.log("✅ Video uploaded to MinIO successfully");

  console.log("\n=== 5. Registering Asset in Routie ===");
  const completeRes = await fetch(`${APP_URL}/api/assets/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objectKey: uploadUrlData.objectKey,
      kind: "VIDEO",
      contentType: "video/mp4",
      sizeBytes: videoSize,
      checksum: `sha256-test-${Date.now()}`
    })
  });
  const completeData = await completeRes.json();
  if (!completeRes.ok) {
    throw new Error(`Failed to complete asset registration: ${JSON.stringify(completeData)}`);
  }
  console.log("✅ Asset registered:", completeData.asset?.id);

  console.log("\n=== 6. Scheduling Content in Calendar (via /api/calendar/slots) ===");
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const slotRes = await fetch(`${APP_URL}/api/calendar/slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "MANUAL",
      localDate: todayStr,
      localTime: timeStr,
      timezone: "Asia/Jakarta",
      channels: ["YOUTUBE"],
      recommendedKind: "SHORT_VIDEO",
      topic: "Routie Auto-Publish YouTube Shorts Live Test",
      hook: "Testing automated YouTube Shorts upload from Routie",
      initialCaption: "🚀 Testing automated YouTube Shorts upload with Routie CRM #Shorts #Automation",
      hashtags: ["#Shorts", "#Routie", "#Automation"],
      contentPillar: "Edukasi & Tips",
      objectKey: uploadUrlData.objectKey,
      mimeType: "video/mp4",
      sizeBytes: videoSize
    })
  });
  const slotData = await slotRes.json();
  if (!slotRes.ok || !slotData.conceptId) {
    throw new Error(`Failed to create calendar slot: ${JSON.stringify(slotData)}`);
  }
  const conceptId = slotData.conceptId;
  console.log(`✅ Calendar slot and concept created with ID: ${conceptId}`);

  console.log("\n=== 7. Approving Content (Setujui & Siap Terbit) ===");
  const approveRes = await fetch(`${APP_URL}/api/concepts/${conceptId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: "APPROVED"
    })
  });
  const approveData = await approveRes.json();
  if (!approveRes.ok) {
    throw new Error(`Failed to approve concept: ${JSON.stringify(approveData)}`);
  }
  console.log(`✅ Concept approved & scheduled! Response:`, approveData);

  console.log("\n=== 8. Monitoring Worker Execution for YouTube Upload ===");
  console.log("Waiting for worker to pick up and process the publishing job...");

  let attempts = 0;
  while (attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    attempts++;

    const jobs = await withTenant(db, WORKSPACE_ID, async (tx) => {
      return tx
        .select()
        .from(publishJobs)
        .where(eq(publishJobs.workspaceId, WORKSPACE_ID))
        .orderBy(publishJobs.createdAt);
    });

    const latestJob = jobs[jobs.length - 1];
    if (latestJob) {
      console.log(`[Status check #${attempts}] Job ID: ${latestJob.id} | Status: ${latestJob.status} | Attempts: ${latestJob.attemptCount}`);
      if (latestJob.status === "SUCCEEDED") {
        console.log("\n🎉🎉🎉 YOUTUBE SHORT PUBLISHED SUCCESSFULLY! 🎉🎉🎉");
        console.log(`🔗 External Post ID: ${latestJob.externalPostId}`);
        console.log(`🔗 Live YouTube Video URL: ${latestJob.externalUrl}`);
        return;
      }
      if (latestJob.status === "FAILED") {
        console.error("\n❌ Job failed with error:", latestJob.lastError);
        return;
      }
      if (latestJob.status === "HELD") {
        console.warn("\n⚠️ Job is HELD. Reason:", latestJob.heldReason);
        return;
      }
    }
  }

  console.log("Polling timed out. Check worker logs.");
}

main().catch((err) => {
  console.error("Test flow error:", err);
  process.exit(1);
});
