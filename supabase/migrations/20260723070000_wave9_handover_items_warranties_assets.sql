-- Wave 9 (Fase 9, modules/maintenance-engine): handover_items, warranties,
-- assets (Facility Passport) -- ADR 0019. Also the "galeri before-after"
-- half of Fase 9's exit criterion: two new nullable columns on Fase 4's
-- photos table, not a new table (ADR 0019 SS8).
--
-- assets depends on nothing new here beyond sites/clients (already exist);
-- maintenance_plans/service_tickets (Wave 10) depend on assets, hence the
-- two-migration split even though both waves are one Fase 9 (ADR 0019 SS1).

-- ===========================================================================
-- handover_items -- one row per deliverable checked off at project handover
-- (a key, an as-built drawing, a certificate...). Staff-entered, not derived
-- (ADR 0019 SS2): there is no source data to derive a physical handover from.
-- ===========================================================================

create table handover_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  zone_id         uuid references zones (id) on delete restrict,
  item_type       text not null,
  description     text,
  handed_over_at  timestamptz,
  handed_over_to  text,
  recorded_by     uuid not null references users (id) on delete restrict,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_handover_items_item_type_not_blank check (btrim(item_type) <> '')
);

create index idx_handover_items_organization_id on handover_items (organization_id) where deleted_at is null;
create index idx_handover_items_project_id on handover_items (project_id) where deleted_at is null;
create index idx_handover_items_zone_id on handover_items (zone_id) where deleted_at is null;

comment on table handover_items is
  'Owned by modules/maintenance-engine (ADR 0019 SS2). One row per deliverable physically handed to the client at project completion (a key, an as-built drawing, a certificate...). zone_id is nullable -- some items are whole-project (e.g. "as-built drawing set"), not per-zone. item_type is free text, not an enum (same reasoning as leads.source, ADR 0018).';

alter table handover_items enable row level security;

create policy handover_items_select_staff
  on handover_items for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy handover_items_insert_staff
  on handover_items for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy handover_items_update_staff
  on handover_items for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('handover_items');

-- ===========================================================================
-- warranties -- one row per handover_items row that plausibly needs one
-- (ADR 0019 SS3). Usually auto-created by fn_projects_sync_warranties_on_completion
-- below, but handover_item_id is nullable so a warranty can also be logged
-- standalone (e.g. a manufacturer's own warranty on installed equipment).
-- ===========================================================================

create type warranty_status as enum ('active', 'expired', 'claimed');

create table warranties (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  project_id       uuid not null references projects (id) on delete restrict,
  handover_item_id uuid references handover_items (id) on delete restrict,
  title            text not null,
  starts_at        date not null,
  ends_at          date not null,
  terms            text,
  status           warranty_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint ck_warranties_title_not_blank check (btrim(title) <> ''),
  constraint ck_warranties_ends_after_starts check (ends_at >= starts_at)
);

create index idx_warranties_organization_id on warranties (organization_id) where deleted_at is null;
create index idx_warranties_project_id on warranties (project_id) where deleted_at is null;
create index idx_warranties_handover_item_id on warranties (handover_item_id) where deleted_at is null;

comment on table warranties is
  'Owned by modules/maintenance-engine (ADR 0019 SS3). handover_item_id is nullable -- most rows are auto-created by fn_projects_sync_warranties_on_completion, but a warranty can also be logged standalone. status is a plain field for now (expired/claimed set by staff); "expired" is not a scheduled-job-flipped column (ADR 0019 SS3, same "computed advisory number" restraint as margin/aging).';

alter table warranties enable row level security;

create policy warranties_select_staff
  on warranties for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy warranties_insert_staff
  on warranties for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy warranties_update_staff
  on warranties for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('warranties');

-- ===========================================================================
-- fn_projects_sync_warranties_on_completion -- AFTER UPDATE OF status on
-- projects, the "otomatis membentuk warranty register" half of Fase 9's exit
-- criterion (ADR 0019 SS3). Same cross-module-sync-trigger shape already used
-- three times before this (work_packages/change_orders, change_orders/
-- client_decisions, invoices/funding_receipts, leads/assessments) -- fires
-- once, the moment status first becomes 'completed', never re-fires on a
-- later unrelated update (guarded by the WHERE below, same discipline as
-- fn_leads_sync_assessment_project).
--
-- Filters which handover_items produce a warranty: 'key' and
-- 'as_built_drawing' don't need one, everything else (a physical
-- installation) does. DEFAULT_WARRANTY_MONTHS = 12 is a single hardcoded
-- constant for v1, not a per-org setting (ADR 0019 SS3/Alternatives --
-- deliberately not building a warranty-terms config screen before any real
-- warranty data exists to prove out the shape).
-- ===========================================================================

create or replace function fn_projects_sync_warranties_on_completion()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    -- Not security definer, so this insert runs as the calling user --
    -- warranties_insert_staff's own RLS check (organization_id =
    -- fn_current_org_id()) still applies, same as every other cross-module
    -- sync trigger in this codebase.
    insert into warranties (organization_id, project_id, handover_item_id, title, starts_at, ends_at)
    select
      hi.organization_id,
      hi.project_id,
      hi.id,
      'Garansi -- ' || hi.item_type,
      coalesce(hi.handed_over_at::date, current_date),
      (coalesce(hi.handed_over_at::date, current_date) + interval '12 months')::date
    from handover_items hi
    where hi.project_id = new.id
      and hi.deleted_at is null
      and hi.item_type not in ('key', 'as_built_drawing');
  end if;

  return new;
end;
$$;

comment on function fn_projects_sync_warranties_on_completion() is
  'ADR 0019 SS3: the moment a project first reaches status = completed, inserts one warranties row per handover_items row that plausibly needs one ("key"/"as_built_drawing" excluded). 12-month default term, editable per row afterward.';

create trigger trg_projects_sync_warranties_on_completion
  after update of status on projects
  for each row execute function fn_projects_sync_warranties_on_completion();

-- ===========================================================================
-- assets (Facility Passport) -- per-site equipment register (ADR 0019 SS4).
-- Scoped to site_id, not project_id: a site outlives any single project.
-- Staff-only, no client-portal view in this phase.
-- ===========================================================================

create table assets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  site_id         uuid not null references sites (id) on delete restrict,
  client_id       uuid not null references clients (id) on delete restrict,
  name            text not null,
  category        text,
  manufacturer    text,
  model           text,
  serial_number   text,
  install_date    date,
  warranty_id     uuid references warranties (id) on delete restrict,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_assets_name_not_blank check (btrim(name) <> '')
);

create index idx_assets_organization_id on assets (organization_id) where deleted_at is null;
create index idx_assets_site_id on assets (site_id) where deleted_at is null;
create index idx_assets_client_id on assets (client_id) where deleted_at is null;
create index idx_assets_warranty_id on assets (warranty_id) where deleted_at is null;

comment on table assets is
  'Owned by modules/maintenance-engine (ADR 0019 SS4). Facility Passport: a site''s installed-equipment register. site_id, not project_id -- a site accumulates assets across multiple projects over its lifetime. client_id is denormalized from site_id (same convention as assessments/leads'' own direct FKs). No client-portal view in this phase.';

alter table assets enable row level security;

create policy assets_select_staff
  on assets for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy assets_insert_staff
  on assets for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy assets_update_staff
  on assets for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('assets');

-- ===========================================================================
-- "Galeri before-after" (ADR 0019 SS8) -- two nullable columns on photos
-- (Fase 4), not a new table: photos already carries project_id/zone_id/
-- storage_path/caption, a parallel table would duplicate all of it. Both
-- nullable: the overwhelming majority of existing photos are neither before
-- nor after a handover. Deliberately two independent columns, not one
-- derived from the other -- a "before" and an "after" photo of the same
-- repair share the same handover_item_id but must stay distinguishable.
-- ===========================================================================

create type photo_stage as enum ('before', 'after');

alter table photos add column handover_item_id uuid references handover_items (id) on delete restrict;
alter table photos add column photo_stage photo_stage;

create index idx_photos_handover_item_id on photos (handover_item_id) where deleted_at is null;

comment on column photos.handover_item_id is 'ADR 0019 SS8. Nullable -- most photos are unrelated to a handover.';
comment on column photos.photo_stage is 'ADR 0019 SS8. Nullable, independent of handover_item_id -- both a before and an after photo of the same repair share the same handover_item_id.';
