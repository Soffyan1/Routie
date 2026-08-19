import { brandProfiles, closeDatabase, createDatabase, entitlements, memberships, users, workspaces } from "./index";

const demo = {
  userId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  externalCustomerId: "demo-customer"
} as const;

async function seed() {
  const connectionString = process.env.DATABASE_INTEGRATION_URL ?? process.env.DATABASE_URL;
  const db = createDatabase(connectionString);
  await db.insert(users).values({
    id: demo.userId,
    externalCustomerId: demo.externalCustomerId,
    email: "owner@routie.local",
    name: "Demo Owner"
  }).onConflictDoUpdate({ target: users.id, set: { name: "Demo Owner", updatedAt: new Date() } });

  await db.insert(workspaces).values({
    id: demo.workspaceId,
    externalCustomerId: demo.externalCustomerId,
    name: "Routie Demo",
    timezone: "Asia/Jakarta",
    language: "id-ID"
  }).onConflictDoUpdate({ target: workspaces.id, set: { name: "Routie Demo", updatedAt: new Date() } });

  await db.insert(memberships).values({ workspaceId: demo.workspaceId, userId: demo.userId, role: "OWNER" })
    .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role: "OWNER" } });
  await db.insert(entitlements).values({ workspaceId: demo.workspaceId, status: "ACTIVE", sourceVersion: "demo" })
    .onConflictDoUpdate({ target: entitlements.workspaceId, set: { status: "ACTIVE", expiredAt: null, graceEndsAt: null, purgeAt: null, updatedAt: new Date() } });
  await db.insert(brandProfiles).values({
    workspaceId: demo.workspaceId,
    businessName: "Routie Demo",
    brief: "Brand demo untuk menguji workflow konten Routie.",
    targetAudience: "Pemilik bisnis digital Indonesia",
    tone: "Santai, jelas, dan membantu",
    callsToAction: ["Coba sekarang"],
    contentPillars: [{ name: "Edukasi", percentage: 60 }, { name: "Produk", percentage: 40 }]
  }).onConflictDoUpdate({ target: brandProfiles.workspaceId, set: { updatedAt: new Date() } });
  console.log(`Seeded demo workspace ${demo.workspaceId}`);
}

seed().finally(closeDatabase).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
