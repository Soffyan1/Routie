import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import {
  calendarSlots,
  conceptResearchSources,
  contentCalendars,
  contentConcepts,
  createDatabase,
  withTenant
} from "@routie/db";
import { AppShell } from "@/components/app-shell";
import { ApprovalCenter, type ApprovalConcept } from "@/components/approval-center";
import { requirePageSession } from "@/lib/page-auth";
import { serverEnv } from "@/lib/env";

export default async function ApprovalsPage() {
  await connection();
  const session = await requirePageSession();
  const db = createDatabase(serverEnv().DATABASE_URL);
  
  const concepts = await withTenant(db, session.workspaceId, async (tx) => {
    const [rows, sourceRows] = await Promise.all([
      tx.select({
        id: contentConcepts.id,
        state: contentConcepts.state,
        version: contentConcepts.version,
        topic: contentConcepts.topic,
        hook: contentConcepts.hook,
        outline: contentConcepts.outline,
        initialCaption: contentConcepts.initialCaption,
        contentPillar: contentConcepts.contentPillar,
        recommendedKind: contentConcepts.recommendedKind,
        heldReason: contentConcepts.heldReason,
        localDate: calendarSlots.localDate,
        localTime: calendarSlots.localTime,
        timezone: calendarSlots.timezone,
        channels: contentCalendars.channels
      })
        .from(contentConcepts)
        .innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId))
        .innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
        .where(eq(contentConcepts.workspaceId, session.workspaceId))
        .orderBy(asc(calendarSlots.scheduledFor)),
      tx.select({
        id: conceptResearchSources.id,
        conceptId: conceptResearchSources.conceptId,
        url: conceptResearchSources.url,
        title: conceptResearchSources.title
      })
        .from(conceptResearchSources)
        .where(eq(conceptResearchSources.workspaceId, session.workspaceId))
    ]);

    return rows.map((row) => ({
      ...row,
      contentPillar: row.contentPillar ?? "Unassigned",
      recommendedKind: row.recommendedKind ?? "IMAGE",
      sources: sourceRows.filter((source) => source.conceptId === row.id).map(({ id, url, title }) => ({ id, url, title }))
    })) as ApprovalConcept[];
  });

  const waiting = concepts.filter((concept) => concept.state === "IDEA_REVIEW" || concept.state === "FINAL_REVIEW").length;

  return (
    <AppShell active="Approvals">
      <div className="crm-page-container crm-approvals-page">
        {/* Page Header */}
        <section className="crm-page-header crm-approvals-header">
          <div className="crm-header-info">
            <span className="crm-header-date">CONTENT GOVERNANCE</span>
            <h1 className="crm-page-title">Approval Center</h1>
            <p className="crm-page-desc">
              Tinjau draf ide, periksa kesesuaian brand, dan setujui sebelum media diproses worker.
            </p>
          </div>
          <div className="crm-approvals-headline-stat">
            <span className="crm-approvals-stat-label"><i /> Menunggu persetujuan</span>
            <strong>{waiting}</strong>
            <span className="crm-approvals-stat-caption">konten aktif di antrian</span>
          </div>
        </section>

        {/* Approval Center Master-Detail Workspace */}
        <ApprovalCenter initialConcepts={concepts} role={session.role} />
      </div>
    </AppShell>
  );
}
