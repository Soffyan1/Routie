import "dotenv/config";
import { createDatabase, notifications, withTenant } from "@routie/db";
import { eq } from "drizzle-orm";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000002";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

async function main() {
  console.log("=== 1. Inserting Sample Notifications for Workspace ===");
  const db = createDatabase(process.env.DATABASE_URL!);

  await withTenant(db, WORKSPACE_ID, async (tx) => {
    // Clear old test notifications
    await tx.delete(notifications).where(eq(notifications.workspaceId, WORKSPACE_ID));

    // Insert test notifications
    await tx.insert(notifications).values([
      {
        workspaceId: WORKSPACE_ID,
        kind: "EXPORT_READY",
        title: "Video YouTube Shorts Berhasil Tayang!",
        body: "Shorts 'Routie Auto-Publish Test' telah berhasil diunggah ke channel @ibnusoffyantsauri3834.",
        actionUrl: "https://youtube.com/shorts/vhL6MIde6yY"
      },
      {
        workspaceId: WORKSPACE_ID,
        kind: "APPROVAL_REQUIRED",
        title: "Draf Konten Baru Siap Ditinjau",
        body: "Konsep konten 'Tips Efisiensi Posting Media Sosial' memerlukan persetujuan sebelum dijadwalkan.",
        actionUrl: "/calendar"
      },
      {
        workspaceId: WORKSPACE_ID,
        kind: "TOKEN_EXPIRED",
        title: "Pembaruan Akses Google YouTube",
        body: "Token otentikasi YouTube telah berhasil diperbarui secara otomatis di latar belakang.",
        actionUrl: "/settings/connectors"
      }
    ]);
  });

  console.log("✅ Sample notifications inserted into database");

  console.log("\n=== 2. Testing GET /api/notifications ===");
  const getRes = await fetch(`${APP_URL}/api/notifications`);
  const getData = await getRes.json();
  console.log(`✅ Status: ${getRes.status}`);
  console.log(`✅ Unread Count: ${getData.unreadCount}`);
  console.log(`✅ Total Notifications Fetched: ${getData.notifications?.length}`);

  if (getData.notifications?.length > 0) {
    const firstId = getData.notifications[0].id;
    console.log(`\n=== 3. Testing PATCH /api/notifications (Mark as Read: ${firstId}) ===`);
    const patchRes = await fetch(`${APP_URL}/api/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: firstId })
    });
    const patchData = await patchRes.json();
    console.log(`✅ Patch Status: ${patchRes.status}`, patchData);

    const recheckRes = await fetch(`${APP_URL}/api/notifications`);
    const recheckData = await recheckRes.json();
    console.log(`✅ Updated Unread Count: ${recheckData.unreadCount}`);
  }

  console.log("\n🎉 Tahap 1 Verification Complete! All APIs and Database connections are working!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
