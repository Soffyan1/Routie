-- Tenant-scoped requests must call set_config('app.workspace_id', ..., true)
-- inside their transaction. Integration and worker roles should be separate
-- PostgreSQL roles with BYPASSRLS and must never be exposed to the browser app.

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON "workspaces"
  USING (id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.workspace_id', true), '')::uuid);

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'memberships', 'entitlements', 'brand_profiles', 'brand_sources',
    'brand_assets', 'provider_credentials', 'social_connections', 'content_calendars',
    'calendar_slots', 'content_concepts', 'concept_research_sources', 'channel_variants',
    'media_assets', 'approvals', 'publish_jobs', 'publish_attempts', 'notifications',
    'magic_links', 'audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      tenant_table
    );
  END LOOP;
END $$;

-- Defense-in-depth constraints that are intentionally independent of the ORM.
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_concepts_per_day_limit" CHECK (max_concepts_per_day BETWEEN 1 AND 3);
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_member_limit_positive" CHECK (max_members BETWEEN 1 AND 100);
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_storage_nonnegative" CHECK (storage_used_bytes >= 0 AND max_storage_bytes > 0);
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_month_valid" CHECK (month BETWEEN 1 AND 12);
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_daily_limit" CHECK (concepts_per_day BETWEEN 1 AND 3);
