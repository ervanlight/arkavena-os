-- Phase 3 milestone 3.5 (F15): project-level final completion sign-off,
-- distinct from per-package QC. WORKFLOW_REVIEW.md 7.1: "no verified
-- 'final project-wide sign-off' concept distinct from the last individual
-- work package's own inspection." Owned by modules/quality-gate -- the
-- module that already owns per-work-package quality authority
-- (hold_point_templates/inspections/nonconformities, ADR 0014) -- this is
-- the same authority exercised once, at the whole-project level, rather
-- than a new domain.
--
-- A single append-only fact table, not a new state machine: one row per
-- project (unique constraint) records that a Technical Director walked the
-- finished project and signed off on it. No update/delete policy, same
-- "this happened" shape as handover_items.

create table project_completion_signoffs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  signed_off_by   uuid not null references users (id) on delete restrict,
  signed_off_at   timestamptz not null default now(),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint uq_project_completion_signoffs_project unique (project_id)
);

create index idx_project_completion_signoffs_organization_id on project_completion_signoffs (organization_id) where deleted_at is null;

comment on table project_completion_signoffs is
  'Owned by modules/quality-gate (Phase 3, F15). At most one row per project (uq_project_completion_signoffs_project) -- the final, whole-project QC walkthrough distinct from any single work package''s own inspection. signed_off_by is restricted to Technical Director only by fn_project_completion_signoffs_guard_td_only, mirroring the same authority fn_inspections_guard_td_only_override already restricts for per-package overrides (ARCHITECTURE.md 4.4).';

alter table project_completion_signoffs enable row level security;

create policy project_completion_signoffs_select_staff
  on project_completion_signoffs for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy project_completion_signoffs_insert_staff
  on project_completion_signoffs for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('project_completion_signoffs');

-- ===========================================================================
-- fn_project_completion_signoffs_guard_td_only -- mirrors
-- fn_inspections_guard_td_only_override's exact shape: RLS lets any staff
-- member's INSERT through, this is the real, unbypassable restriction
-- (CLAUDE.md 0.3).
-- ===========================================================================

create or replace function fn_project_completion_signoffs_guard_td_only()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_role org_role;
begin
  select org_role into v_role from users where id = new.signed_off_by and deleted_at is null;

  if v_role is distinct from 'technical_director' then
    raise exception
      'Hanya Technical Director yang boleh menandatangani serah terima final proyek'
      using errcode = 'insufficient_privilege',
            hint = 'Phase 3 F15, ARCHITECTURE.md 4.4.';
  end if;

  return new;
end;
$$;

comment on function fn_project_completion_signoffs_guard_td_only() is
  'Phase 3 (F15): restricts signed_off_by to Technical Director only, the same authority ARCHITECTURE.md 4.4 already gives per-package hold-point overrides.';

create trigger trg_project_completion_signoffs_guard_td_only
  before insert on project_completion_signoffs
  for each row execute function fn_project_completion_signoffs_guard_td_only();

-- ===========================================================================
-- fn_projects_guard_completion_signoff -- BEFORE UPDATE OF status on
-- projects: blocks the transition into 'completed' unless a sign-off
-- already exists, the same "third independent gate on the same table"
-- shape trg_work_packages_guard_cash_gate/trg_work_packages_guard_hold_point/
-- trg_work_packages_guard_evidence already established for work_packages --
-- here for projects.status instead. A BEFORE trigger, so it necessarily
-- runs before fn_projects_sync_warranties_on_completion and
-- fn_projects_sync_handover_signoff_decision (both AFTER triggers on the
-- same event) -- Postgres always finishes every BEFORE trigger before any
-- AFTER trigger fires, so no explicit ordering is needed between them.
-- ===========================================================================

create or replace function fn_projects_guard_completion_signoff()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if not exists (
      select 1 from project_completion_signoffs
      where project_id = new.id and deleted_at is null
    ) then
      raise exception
        'Proyek belum bisa ditandai selesai -- serah terima final dari Technical Director belum ada'
        using errcode = 'check_violation',
              hint = 'Phase 3 F15.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_projects_guard_completion_signoff() is
  'Phase 3 (F15): blocks projects.status -> completed unless a project_completion_signoffs row exists for this project. Independent of trg_work_packages_guard_* -- this gates the project as a whole, not any one work package.';

create trigger trg_projects_guard_completion_signoff
  before update of status on projects
  for each row execute function fn_projects_guard_completion_signoff();
