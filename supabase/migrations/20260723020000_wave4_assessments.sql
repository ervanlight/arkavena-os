-- Wave 4 (Fase 8): assessments (ARCHITECTURE.md 2.1, 8), ADR 0018 SS3.
-- Site-level, not project-level: site_id is the only required anchor, since a
-- real assessment routinely happens before any project exists. lead_id is
-- lineage back to whichever lead triggered it; project_id starts null and is
-- filled in once (never reassigned) by fn_leads_sync_assessment_project below
-- -- the same "trigger on module A's table writes into module B's table"
-- cross-module-sync pattern already used three times (work_packages/
-- change_orders, change_orders/client_decisions, invoices/funding_receipts),
-- applied here so modules/crm's convertLeadToProjectAction does not need to
-- know modules/assessment's table exists at all.

create type assessment_status as enum ('scheduled', 'completed');

create table assessments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete restrict,
  site_id             uuid not null references sites (id) on delete restrict,
  lead_id             uuid references leads (id) on delete restrict,
  project_id          uuid references projects (id) on delete restrict,
  status              assessment_status not null default 'scheduled',
  site_conditions     text,
  recommended_scope   text,
  notes               text,
  assessed_by         uuid references users (id) on delete restrict,
  assessed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint ck_assessments_completed_requires_assessor
    check (status <> 'completed' or (assessed_by is not null and assessed_at is not null))
);

create index idx_assessments_organization_id on assessments (organization_id) where deleted_at is null;
create index idx_assessments_site_id on assessments (site_id) where deleted_at is null;
create index idx_assessments_lead_id on assessments (lead_id) where deleted_at is null;
create index idx_assessments_project_id on assessments (project_id) where deleted_at is null;

comment on table assessments is
  'Owned by modules/assessment (ADR 0018 SS3). site_id is the only mandatory anchor -- a real assessment usually predates any project. project_id is set once by fn_leads_sync_assessment_project when the linked lead is converted, never reassigned after.';

alter table assessments enable row level security;

-- Staff-only, no project role and no client visibility -- same shape as
-- leads (this is pre-sale/internal work, not something a client portal or
-- SiteFlow role reaches; ARCHITECTURE.md 2.6's client-view restriction).
create policy assessments_select_staff
  on assessments for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy assessments_insert_staff
  on assessments for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy assessments_update_staff
  on assessments for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('assessments');

-- ===========================================================================
-- fn_leads_sync_assessment_project -- AFTER UPDATE on leads. The moment a
-- lead's project_id is first set (convertLeadToProjectAction, at 'qualified'),
-- backfill the same project_id onto every assessment already linked to that
-- lead that doesn't have one yet. One-directional and one-time per row: an
-- assessment's project_id, once set, is never overwritten by this trigger
-- (old.project_id is not null is excluded by the WHERE below via the guard
-- condition), matching estimates' own "set once" baseline discipline.
-- ===========================================================================

create or replace function fn_leads_sync_assessment_project()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if old.project_id is null and new.project_id is not null then
    update assessments
    set project_id = new.project_id
    where lead_id = new.id
      and project_id is null
      and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function fn_leads_sync_assessment_project() is
  'Cross-module sync (ARCHITECTURE.md 1.2): backfills assessments.project_id from leads.project_id the moment convertLeadToProjectAction sets the latter, so modules/crm never needs to reach into modules/assessment''s table directly (ADR 0018 SS3).';

create trigger trg_leads_sync_assessment_project
  after update of project_id on leads
  for each row execute function fn_leads_sync_assessment_project();
