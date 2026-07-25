-- Fase 12 (modules/evidence): ADR 0026 §3, ADR 0029 (Accepted 2026-07-25).
--
-- `evidence` is a cross-module index of accountability evidence, polymorphic
-- over (activity_table, activity_id) -- the same pattern audit_logs already
-- uses for (entity_table, entity_id). It does NOT replace field-reporting's
-- `photos` table (ADR 0029 Decision 3, Option 3a): field-reporting's own
-- photo-upload action calls modules/evidence's recordEvidenceFromPhoto
-- action to create a matching row automatically, in the same transaction,
-- closing the "did someone remember" sync-gap risk structurally.

create type evidence_type as enum ('photo', 'video', 'document');
create type evidence_visibility as enum ('internal_only', 'internal_management', 'client_visible', 'visible_after_approval');
create type evidence_qc_result as enum ('pass', 'fail', 'not_applicable');

create table evidence (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations (id) on delete restrict,
  project_id           uuid not null references projects (id) on delete restrict,
  -- Polymorphic, same shape as audit_logs.entity_table/entity_id. Restricted
  -- to a known set (ADR 0029 Decision 3's mapping priority: work_packages ->
  -- daily_logs -> handover_items) rather than any table name.
  activity_table       text not null,
  activity_id          uuid not null,
  evidence_type        evidence_type not null,
  -- Default internal_only (ADR 0026 §3.2, confirmed by ADR 0029): client
  -- visibility is a deliberate opt-in per row, never the default.
  visibility           evidence_visibility not null default 'internal_only',
  storage_path         text not null,
  thumbnail_path       text,
  captured_at          timestamptz not null default now(),
  gps_lat              double precision,
  gps_lng              double precision,
  qc_result            evidence_qc_result,
  responsible_user_id  uuid not null references users (id) on delete restrict,
  notes                text,
  created_by           uuid not null references users (id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,

  constraint ck_evidence_activity_table_known check (
    activity_table in ('work_packages', 'daily_logs', 'handover_items')
  ),
  constraint ck_evidence_gps_both_or_neither check (
    (gps_lat is null) = (gps_lng is null)
  )
);

create index idx_evidence_organization_id on evidence (organization_id) where deleted_at is null;
create index idx_evidence_project_id on evidence (project_id) where deleted_at is null;
create index idx_evidence_activity on evidence (activity_table, activity_id) where deleted_at is null;
-- Supports the Client Timeline's own lookup exactly: this project's
-- client-visible evidence, newest first.
create index idx_evidence_project_visibility_captured on evidence (project_id, visibility, captured_at desc) where deleted_at is null;

comment on table evidence is
  'Owned by modules/evidence (ADR 0026 §3, ADR 0029). Cross-module accountability index, polymorphic (activity_table, activity_id). Not a replacement for field-reporting''s photos -- see ADR 0029 Decision 3.';

alter table evidence enable row level security;

create policy evidence_select_staff
  on evidence for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- Client Timeline's own read path -- exactly one condition, no additional
-- "is this project client-facing" check needed here: visibility can only
-- ever be client_visible via a deliberate staff/approval action in the
-- first place (ADR 0026 §3.2/§3.3), so the row's own visibility column is
-- already the authoritative signal.
create policy evidence_select_client
  on evidence for select
  to authenticated
  using (
    visibility = 'client_visible'
    and fn_has_project_role(project_id, array['client_approver', 'client_viewer'])
  );

create policy evidence_insert_staff
  on evidence for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- Field roles (site_coordinator/mandor) create evidence directly when they
-- capture it themselves -- same project-role gate every field-reporting
-- table already uses (see photo/daily_log RLS).
create policy evidence_insert_field
  on evidence for insert
  to authenticated
  with check (fn_has_project_role(project_id, array['site_coordinator', 'mandor']));

-- Update is narrow in practice (visibility promotion by releaseEvidence,
-- called from another module's own approval action) -- staff-only, RLS is
-- the coarse filter, application logic decides which specific transitions
-- are legal.
create policy evidence_update_staff
  on evidence for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('evidence');

-- ===========================================================================
-- evidence_overrides -- Technical Director's escape hatch for the
-- completion gate below (ADR 0029 Decision 1, amended from Owner-only to
-- Technical Director during design review: Evidence-gating is a
-- documentation/verification control, the same authority tier as Quality
-- Gate's hold-point override, not a financial control like Cash Gate).
-- ===========================================================================

create table evidence_overrides (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  project_id        uuid not null references projects (id) on delete restrict,
  work_package_id   uuid not null references work_packages (id) on delete restrict,
  reason            text not null,
  overridden_by     uuid not null references users (id) on delete restrict,
  created_at        timestamptz not null default now(),

  constraint ck_evidence_overrides_reason_not_blank check (btrim(reason) <> '')
);

create index idx_evidence_overrides_organization_id on evidence_overrides (organization_id);
create index idx_evidence_overrides_work_package_id on evidence_overrides (work_package_id);

comment on table evidence_overrides is
  'Owned by modules/evidence (ADR 0029 Decision 1). One row per override -- a permanent record of one Technical Director authorizing one work package''s completion without qualifying evidence, with a mandatory reason. Append-only: no UPDATE or DELETE policy for anyone.';

alter table evidence_overrides enable row level security;

create policy evidence_overrides_select_staff
  on evidence_overrides for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- RLS is the coarse filter (any staff of this org); the trigger below is
-- the precise check (technical_director specifically) -- same two-layer
-- split as cash_gate_overrides' owner-only guard.
create policy evidence_overrides_insert_staff
  on evidence_overrides for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create or replace function fn_evidence_overrides_guard_td_only()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_role org_role;
begin
  select org_role into v_role from users where id = new.overridden_by and deleted_at is null;

  if v_role is distinct from 'technical_director' then
    raise exception
      'Hanya Technical Director yang boleh meng-override Evidence Gate'
      using errcode = 'insufficient_privilege',
            hint = 'ADR 0029 Keputusan 1.';
  end if;

  return new;
end;
$$;

comment on function fn_evidence_overrides_guard_td_only() is
  'Enforces ADR 0029 Decision 1''s "Technical Director only" rule at the database layer, alongside requirePermission() at the application layer.';

create trigger trg_evidence_overrides_guard_td_only
  before insert on evidence_overrides
  for each row execute function fn_evidence_overrides_guard_td_only();

create trigger trg_evidence_overrides_audit
  after insert or update or delete on evidence_overrides
  for each row execute function fn_audit_row_change();

-- ===========================================================================
-- fn_override_evidence_gate -- atomic insert-override-and-complete, same
-- shape as ADR 0010's fn_override_and_open_work_package: one Postgres
-- function call is inherently one transaction, so there is no window where
-- the override is recorded but the work package isn't actually marked
-- complete, or vice versa.
-- ===========================================================================

create or replace function fn_override_evidence_gate(
  p_work_package_id uuid,
  p_reason text
)
returns work_packages
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_work_package work_packages;
  v_organization_id uuid;
  v_project_id uuid;
begin
  select organization_id, project_id into v_organization_id, v_project_id
  from work_packages
  where id = p_work_package_id and deleted_at is null;

  if v_project_id is null then
    raise exception 'Work package % not found', p_work_package_id using errcode = 'no_data_found';
  end if;

  insert into evidence_overrides (organization_id, project_id, work_package_id, reason, overridden_by)
  values (v_organization_id, v_project_id, p_work_package_id, p_reason, (select auth.uid()));

  update work_packages
  set status = 'completed'
  where id = p_work_package_id
  returning * into v_work_package;

  return v_work_package;
end;
$$;

comment on function fn_override_evidence_gate(uuid, text) is
  'ADR 0029 Decision 1: inserts the override and completes the work package in one transaction. RLS and trg_evidence_overrides_guard_td_only both still apply to the calling user -- this function grants no privilege of its own.';

-- ===========================================================================
-- fn_work_packages_guard_evidence -- the completion-time gate itself
-- (ADR 0029 Decision 1+2): a third, independent gate on work_packages
-- alongside trg_work_packages_guard_cash_gate (Fase 2) and
-- trg_work_packages_guard_hold_point (Fase 5) -- any of the three can block
-- the same transition on its own, none substitutes for another.
--
-- Scoped to client-facing projects only (ADR 0029 Decision 2, reusing
-- ADR 0028's contracts.status = 'active' condition -- the same one
-- isProjectClientFacing() checks in application code, kept in sync here at
-- the SQL level since the DB trigger cannot call a TypeScript function).
-- ===========================================================================

create or replace function fn_work_packages_guard_evidence()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_is_client_facing boolean;
  v_has_evidence boolean;
  v_has_override boolean;
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new; -- already completed; not a transition into it
  end if;

  select exists (
    select 1 from contracts c
    where c.project_id = new.project_id
      and c.status = 'active'
      and c.deleted_at is null
  ) into v_is_client_facing;

  if not v_is_client_facing then
    return new; -- ADR 0029 Decision 2: not gated until the project is client-facing
  end if;

  select exists (
    select 1 from evidence e
    where e.activity_table = 'work_packages'
      and e.activity_id = new.id
      and e.deleted_at is null
  ) into v_has_evidence;

  if v_has_evidence then
    return new;
  end if;

  select exists (
    select 1 from evidence_overrides eo
    where eo.work_package_id = new.id
  ) into v_has_override;

  if v_has_override then
    return new;
  end if;

  raise exception
    'Evidence belum ada: paket kerja ini belum bisa ditandai selesai tanpa bukti (foto/video/dokumen), atau di-override oleh Technical Director dengan alasan'
    using errcode = 'check_violation',
          hint = 'ADR 0029 Keputusan 1+2.';
end;
$$;

comment on function fn_work_packages_guard_evidence() is
  'ADR 0029 Decision 1+2: blocks work_packages.status transitioning to completed, for client-facing projects only, unless qualifying evidence or a Technical Director override exists. Independent of trg_work_packages_guard_cash_gate and trg_work_packages_guard_hold_point -- any of the three can block on its own.';

create trigger trg_work_packages_guard_evidence
  before insert or update on work_packages
  for each row execute function fn_work_packages_guard_evidence();
