-- Fase 4 (Field Reporting / SiteFlow, ARCHITECTURE.md 2.1, module
-- field-reporting): daily_logs and material_requests are named Wave 7 in
-- the dependency chain, progress_entries/photos/issues are Wave 8 -- built
-- together here because Fase 4 is the phase that needs all five, and none
-- of them depend on anything from purchase_orders/inspections/
-- nonconformities/client_decisions/invoices, which stay unbuilt until their
-- own owning module's phase (CLAUDE.md law 7).
--
-- Every table here is internal field data. CLAUDE.md 7: "Role eksternal
-- tidak pernah akses tabel internal" -- unlike work_packages/zones/projects
-- (Fase 1), which any project role may read, these five are scoped to only
-- the two field-facing project roles (site_coordinator, mandor). A client,
-- supplier, or subcontractor gets nothing here, same reasoning contracts/
-- milestones already established for money -- this is operational detail,
-- not something external parties see directly.

create type material_request_status as enum ('requested', 'fulfilled', 'cancelled');
create type issue_severity as enum ('low', 'medium', 'high');
create type issue_status as enum ('open', 'resolved');

-- ===========================================================================
-- daily_logs -- one report per project per day. Zone-level detail lives on
-- the child rows (progress_entries, photos), not here: a daily log is the
-- site coordinator's whole-site summary for that date.
-- ===========================================================================

create table daily_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  log_date        date not null,
  reported_by     uuid not null references users (id) on delete restrict,
  weather         text,
  manpower_count  integer,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint uq_daily_logs_project_id_log_date unique (project_id, log_date),
  constraint ck_daily_logs_manpower_count_non_negative check (manpower_count is null or manpower_count >= 0)
);

create index idx_daily_logs_organization_id on daily_logs (organization_id) where deleted_at is null;
create index idx_daily_logs_project_id_log_date on daily_logs (project_id, log_date) where deleted_at is null;

comment on table daily_logs is
  'Owned by modules/field-reporting. One row per project per calendar day -- the site coordinator''s whole-site summary. Fase 4 (SiteFlow).';

alter table daily_logs enable row level security;

create policy daily_logs_select_staff
  on daily_logs for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy daily_logs_select_field
  on daily_logs for select
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy daily_logs_insert_staff
  on daily_logs for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy daily_logs_insert_field
  on daily_logs for insert
  to authenticated
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy daily_logs_update_staff
  on daily_logs for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy daily_logs_update_field
  on daily_logs for update
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']))
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

select fn_install_standard_triggers('daily_logs');

-- ===========================================================================
-- progress_entries -- per-work-package progress within one day's log.
-- ===========================================================================

create table progress_entries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  project_id        uuid not null references projects (id) on delete restrict,
  daily_log_id      uuid not null references daily_logs (id) on delete restrict,
  work_package_id   uuid not null references work_packages (id) on delete restrict,
  progress_percent  integer not null,
  notes             text,
  created_by        uuid not null references users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_progress_entries_percent_range check (progress_percent between 0 and 100)
);

create index idx_progress_entries_organization_id on progress_entries (organization_id) where deleted_at is null;
create index idx_progress_entries_daily_log_id on progress_entries (daily_log_id) where deleted_at is null;
create index idx_progress_entries_work_package_id on progress_entries (work_package_id) where deleted_at is null;

comment on table progress_entries is
  'Owned by modules/field-reporting. One row per work package touched on a given daily_log. Fase 4 (SiteFlow).';

alter table progress_entries enable row level security;

create policy progress_entries_select_staff
  on progress_entries for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy progress_entries_select_field
  on progress_entries for select
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy progress_entries_insert_staff
  on progress_entries for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy progress_entries_insert_field
  on progress_entries for insert
  to authenticated
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy progress_entries_update_staff
  on progress_entries for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy progress_entries_update_field
  on progress_entries for update
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']))
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

select fn_install_standard_triggers('progress_entries');

-- ===========================================================================
-- photos -- project_id and zone_id are both NOT NULL: ARCHITECTURE.md 7's
-- exit criteria is literally "foto selalu terikat proyek+zona". work_package_id
-- and daily_log_id are optional additional tags. inspection_id is
-- deliberately absent -- ARCHITECTURE.md 2.1's own footnote says that FK
-- arrives as a separate ALTER once `inspections` exists (Fase 5).
-- ===========================================================================

create table photos (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  project_id        uuid not null references projects (id) on delete restrict,
  zone_id           uuid not null references zones (id) on delete restrict,
  work_package_id    uuid references work_packages (id) on delete restrict,
  daily_log_id      uuid references daily_logs (id) on delete restrict,
  storage_path      text not null,
  thumbnail_path    text not null,
  file_size_bytes   bigint not null,
  caption           text,
  uploaded_by       uuid not null references users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_photos_file_size_positive check (file_size_bytes > 0)
);

create index idx_photos_organization_id on photos (organization_id) where deleted_at is null;
create index idx_photos_project_id_zone_id on photos (project_id, zone_id) where deleted_at is null;

comment on table photos is
  'Owned by modules/field-reporting. Always tied to project+zone (ARCHITECTURE.md 7 exit criteria). file_size_bytes feeds the per-organisation storage usage counter (ADR 0008-D2, 200-400KB compression target).';

alter table photos enable row level security;

create policy photos_select_staff
  on photos for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy photos_select_field
  on photos for select
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy photos_insert_staff
  on photos for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy photos_insert_field
  on photos for insert
  to authenticated
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy photos_update_staff
  on photos for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy photos_update_field
  on photos for update
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']))
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

select fn_install_standard_triggers('photos');

-- ===========================================================================
-- material_requests -- a simple ask-for-material record. The real ordering/
-- fulfilment workflow (purchase_orders, vendor_quotes) is Fase 8
-- (procurement); this table only tracks the field-side request itself, so
-- its status lifecycle is deliberately minimal (requested/fulfilled/
-- cancelled) rather than anticipating Fase 8's richer states.
-- ===========================================================================

create table material_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  project_id       uuid not null references projects (id) on delete restrict,
  zone_id          uuid references zones (id) on delete restrict,
  work_package_id  uuid references work_packages (id) on delete restrict,
  requested_by     uuid not null references users (id) on delete restrict,
  item_description text not null,
  quantity         numeric not null,
  unit             text not null,
  needed_by_date   date,
  status           material_request_status not null default 'requested',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint ck_material_requests_item_description_not_blank check (btrim(item_description) <> ''),
  constraint ck_material_requests_quantity_positive check (quantity > 0)
);

create index idx_material_requests_organization_id on material_requests (organization_id) where deleted_at is null;
create index idx_material_requests_project_id on material_requests (project_id) where deleted_at is null;

comment on table material_requests is
  'Owned by modules/field-reporting. The field-side ask; Fase 8''s procurement module owns actually ordering/fulfilling it. Fase 4 (SiteFlow).';

alter table material_requests enable row level security;

create policy material_requests_select_staff
  on material_requests for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy material_requests_select_field
  on material_requests for select
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy material_requests_insert_staff
  on material_requests for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy material_requests_insert_field
  on material_requests for insert
  to authenticated
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy material_requests_update_staff
  on material_requests for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy material_requests_update_field
  on material_requests for update
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']))
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

select fn_install_standard_triggers('material_requests');

-- ===========================================================================
-- issues -- a simple open/resolved lifecycle. Blocking a work package on an
-- unresolved issue is Fase 5's (quality-gate) job; this table only records
-- the issue itself.
-- ===========================================================================

create table issues (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  zone_id         uuid references zones (id) on delete restrict,
  work_package_id uuid references work_packages (id) on delete restrict,
  reported_by     uuid not null references users (id) on delete restrict,
  title           text not null,
  description     text,
  severity        issue_severity not null default 'medium',
  status          issue_status not null default 'open',
  resolved_by     uuid references users (id) on delete restrict,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_issues_title_not_blank check (btrim(title) <> '')
);

create index idx_issues_organization_id on issues (organization_id) where deleted_at is null;
create index idx_issues_project_id on issues (project_id) where deleted_at is null;

comment on table issues is
  'Owned by modules/field-reporting. Fase 4 (SiteFlow). Blocking work on an unresolved issue is Fase 5''s (quality-gate) concern, not this table''s.';

alter table issues enable row level security;

create policy issues_select_staff
  on issues for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy issues_select_field
  on issues for select
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy issues_insert_staff
  on issues for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy issues_insert_field
  on issues for insert
  to authenticated
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

create policy issues_update_staff
  on issues for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy issues_update_field
  on issues for update
  to authenticated
  using (fn_has_project_role(project_id, array['site_coordinator', 'mandor']))
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

select fn_install_standard_triggers('issues');
