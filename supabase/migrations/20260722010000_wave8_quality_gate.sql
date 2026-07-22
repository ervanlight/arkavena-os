-- Fase 5 (Quality Gate, ARCHITECTURE.md 2.1/4.4/7, module quality-gate; see
-- ADR 0014 for the schema decisions this migration implements).
--
-- Staff-only, like contracts/milestones (Fase 1) -- this is an internal QC
-- mechanism QS/Technical Director operate, not something site_coordinator/
-- mandor writes to. Unlike Fase 4's field-reporting tables, nothing here
-- lists a project-role policy at all.

create type inspection_status as enum ('pending', 'passed', 'failed');

-- ===========================================================================
-- hold_point_templates -- reusable, admin-managed data (ADR 0014 decision 1):
-- adding a new kind of hold point is a row, not a migration.
-- ===========================================================================

create table hold_point_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  work_type       text not null,
  name            text not null,
  description     text,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index idx_hold_point_templates_organization_id on hold_point_templates (organization_id) where deleted_at is null;
create index idx_hold_point_templates_work_type on hold_point_templates (organization_id, work_type) where deleted_at is null and is_active;

comment on table hold_point_templates is
  'Owned by modules/quality-gate. Reusable hold-point definitions per work_type (waterproofing, plumbing, struktur, ...) -- data, not hardcoded logic (ARCHITECTURE.md 4.4). Fase 5.';

alter table hold_point_templates enable row level security;

create policy hold_point_templates_select_staff
  on hold_point_templates for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy hold_point_templates_insert_staff
  on hold_point_templates for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy hold_point_templates_update_staff
  on hold_point_templates for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('hold_point_templates');

-- ===========================================================================
-- work_packages gets a new nullable work_type column (ADR 0014 decision 2):
-- what a work package's own type is determines which hold_point_templates
-- apply to it. Additive ALTER, per CLAUDE.md 2's expand pattern -- nothing
-- about the existing Wave 6 table changes.
-- ===========================================================================

alter table work_packages add column work_type text;

comment on column work_packages.work_type is
  'Optional; matched against hold_point_templates.work_type to decide which hold points must pass before this work package may move to in_progress (fn_work_packages_guard_hold_point). Null means no hold-point requirement applies. ADR 0014.';

-- ===========================================================================
-- inspections -- one row per hold-point check against one work package.
-- ARCHITECTURE.md 2.1: inspections -> work_packages, zones (both mandatory).
-- ===========================================================================

create table inspections (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations (id) on delete restrict,
  project_id             uuid not null references projects (id) on delete restrict,
  work_package_id        uuid not null references work_packages (id) on delete restrict,
  zone_id                uuid not null references zones (id) on delete restrict,
  hold_point_template_id uuid not null references hold_point_templates (id) on delete restrict,
  status                 inspection_status not null default 'pending',
  inspected_by           uuid references users (id) on delete restrict,
  inspected_at           timestamptz,
  notes                  text,
  overridden_by          uuid references users (id) on delete restrict,
  override_reason        text,
  overridden_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

create index idx_inspections_organization_id on inspections (organization_id) where deleted_at is null;
create index idx_inspections_work_package_id on inspections (work_package_id) where deleted_at is null;

comment on table inspections is
  'Owned by modules/quality-gate. One row per hold-point check against one work package (ARCHITECTURE.md 4.4). override columns are the TD-only escape hatch, guarded by fn_inspections_guard_td_only_override. Fase 5.';

alter table inspections enable row level security;

create policy inspections_select_staff
  on inspections for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy inspections_insert_staff
  on inspections for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy inspections_update_staff
  on inspections for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('inspections');

-- ---------------------------------------------------------------------------
-- fn_inspections_guard_td_only_override -- ARCHITECTURE.md 4.4: "Override
-- teknis hanya oleh Technical Director". Mirrors
-- fn_cash_gate_overrides_guard_owner_only's shape exactly (Fase 2): the
-- matrix/requirePermission layer gives the friendly Indonesian refusal,
-- this trigger is the real, unbypassable enforcement (CLAUDE.md 0.3).
-- ---------------------------------------------------------------------------

create or replace function fn_inspections_guard_td_only_override()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_role org_role;
begin
  if new.overridden_by is null then
    return new;
  end if;

  select org_role into v_role from users where id = new.overridden_by and deleted_at is null;

  if v_role is distinct from 'technical_director' then
    raise exception
      'Hanya Technical Director yang boleh melakukan override hold point'
      using errcode = 'insufficient_privilege',
            hint = 'ARCHITECTURE.md 4.4, ADR 0014.';
  end if;

  return new;
end;
$$;

comment on function fn_inspections_guard_td_only_override() is
  'Enforces ARCHITECTURE.md 4.4''s "Technical Director only" override rule at the database layer, alongside requirePermission() at the application layer.';

create trigger trg_inspections_guard_td_only_override
  before insert or update of overridden_by on inspections
  for each row execute function fn_inspections_guard_td_only_override();

-- ===========================================================================
-- nonconformities -- defects found during an inspection.
-- ARCHITECTURE.md 2.1: nonconformities -> inspections.
-- ===========================================================================

create table nonconformities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  inspection_id   uuid not null references inspections (id) on delete restrict,
  description     text not null,
  severity        issue_severity not null default 'medium',
  resolved_at     timestamptz,
  resolved_by     uuid references users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index idx_nonconformities_organization_id on nonconformities (organization_id) where deleted_at is null;
create index idx_nonconformities_inspection_id on nonconformities (inspection_id) where deleted_at is null;

comment on table nonconformities is
  'Owned by modules/quality-gate. Defects found during one inspection. severity reuses Fase 4''s issue_severity enum -- same low/medium/high meaning, no reason to duplicate the type (ADR 0014). Fase 5.';

alter table nonconformities enable row level security;

create policy nonconformities_select_staff
  on nonconformities for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy nonconformities_insert_staff
  on nonconformities for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy nonconformities_update_staff
  on nonconformities for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('nonconformities');

-- ===========================================================================
-- fn_work_packages_guard_hold_point -- the second, independent gate
-- alongside Fase 2's trg_work_packages_guard_cash_gate (ADR 0014, Bab 4.5:
-- "cash gate merah tetap memblokir walau semua QC lulus", and the mirror:
-- passing QC does not open a red cash gate). Fires on INSERT as well as
-- UPDATE for the same reason the cash gate trigger does -- a work package
-- inserted directly with status = 'in_progress' must not bypass the check.
-- ===========================================================================

create or replace function fn_work_packages_guard_hold_point()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_unmet_count integer;
begin
  if new.status is distinct from 'in_progress' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'in_progress' then
    return new; -- already in_progress; not a transition into it
  end if;

  if new.work_type is null then
    return new; -- no hold-point requirement applies to this work package
  end if;

  select count(*) into v_unmet_count
  from hold_point_templates hpt
  where hpt.organization_id = new.organization_id
    and hpt.work_type = new.work_type
    and hpt.is_active
    and hpt.deleted_at is null
    and not exists (
      select 1 from inspections i
      where i.work_package_id = new.id
        and i.hold_point_template_id = hpt.id
        and i.deleted_at is null
        and (i.status = 'passed' or i.overridden_by is not null)
    );

  if v_unmet_count > 0 then
    raise exception
      'Hold point belum lulus: % pemeriksaan wajib untuk jenis pekerjaan "%" belum disetujui', v_unmet_count, new.work_type
      using errcode = 'check_violation',
            hint = 'ARCHITECTURE.md 4.4, ADR 0014.';
  end if;

  return new;
end;
$$;

comment on function fn_work_packages_guard_hold_point() is
  'ARCHITECTURE.md 4.4''s DB-layer Hold Point enforcement for work_packages, independent of trg_work_packages_guard_cash_gate (Fase 2) -- either gate can block the same transition on its own. Fires on the transition into status=in_progress, whether by INSERT or UPDATE.';

create trigger trg_work_packages_guard_hold_point
  before insert or update on work_packages
  for each row execute function fn_work_packages_guard_hold_point();
