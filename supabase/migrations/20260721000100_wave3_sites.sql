-- Wave 3: sites (ARCHITECTURE.md 2.1, minimal scope per ADR 0007).
--
-- leads is also nominally Wave 3, but lead capture and scoring belongs to the
-- crm module's Fase 8 scope, not Fase 1's "crm(dasar)". This migration is
-- deliberately just sites.
--
-- Kept minimal on purpose (ADR 0007): enough for projects.site_id to be a
-- real, not-null foreign key from its first migration. Site history, multiple
-- contacts, and location metadata belong to whichever later phase actually
-- reads them -- adding columns then is additive, not a rework.

create table sites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  client_id       uuid not null references clients (id) on delete restrict,
  name            text not null,
  address         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_sites_name_not_blank check (btrim(name) <> '')
);

create index idx_sites_organization_id on sites (organization_id) where deleted_at is null;
create index idx_sites_client_id on sites (client_id) where deleted_at is null;

comment on table sites is
  'Owned by modules/crm. A physical location belonging to a client -- where a project happens. Minimal by design (ADR 0007, ARCHITECTURE.md 9 D-scope): exists so projects.site_id has a real FK, not the fuller Facility Passport shape Fase 9 (assets) will need.';

alter table sites enable row level security;

create policy sites_select_staff
  on sites for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy sites_insert_staff
  on sites for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy sites_update_staff
  on sites for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- No DELETE policy, matching clients: on delete restrict everywhere sites.id
-- is referenced makes an accidental hard delete fail loudly instead of
-- orphaning a project.

select fn_install_standard_triggers('sites');
