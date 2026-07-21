-- Wave 7 (Fase 3): change_orders (ARCHITECTURE.md 2.1, 4.3), ADR 0012.
--
-- Same two-layer principle as Cash Gate (CLAUDE.md 0.3): the state machine
-- lives as pure data in modules/scope-variation/domain/transition.ts, and
-- this file mirrors the same TRANSITIONS graph in a trigger, so a direct SQL
-- update cannot walk the status through an illegal edge even if the
-- application shell is bypassed.
--
-- Unlike Cash Gate, change_orders.status is itself stored state (not a
-- computed read), so it needs its own transition-guard trigger -- nothing in
-- Fase 2 needed this because fn_cash_gate_status never persists a status,
-- it recomputes one on every read.

create type change_order_status as enum (
  'draft',
  'under_review',
  'awaiting_client_approval',
  'approved_unpaid',
  'approved_funded',
  'rejected',
  'completed'
);

-- ===========================================================================
-- change_orders
--
-- cost_impact_amount deliberately has NO non-negative check, unlike every
-- other money column in this codebase (ADR 0008) -- ADR 0012 decision 4: a
-- variation can remove scope, which is a cost reduction. schedule_impact_days
-- is a plain integer for the same reason (negative = accelerated schedule).
-- Both are nullable: ARCHITECTURE.md 4.3's client_approve guard ("harus ada
-- dampak biaya + dampak jadwal terisi") only makes sense if they can be
-- absent earlier in the lifecycle (filled in during under_review) and
-- required by the time a client is asked to decide.
-- ===========================================================================

create table change_orders (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete restrict,
  project_id              uuid not null references projects (id) on delete restrict,
  zone_id                 uuid references zones (id) on delete restrict,
  title                   text not null,
  description             text,
  cost_impact_amount      bigint,
  schedule_impact_days    integer,
  status                  change_order_status not null default 'draft',

  requested_by            uuid not null references users (id) on delete restrict,
  reviewed_by             uuid references users (id) on delete restrict,
  reviewed_at             timestamptz,
  rejected_by             uuid references users (id) on delete restrict,
  rejected_at             timestamptz,
  rejected_reason         text,
  client_approved_by      uuid references users (id) on delete restrict,
  client_approved_at      timestamptz,
  client_approved_reason  text,
  funded_by               uuid references users (id) on delete restrict,
  funded_at               timestamptz,
  completed_by            uuid references users (id) on delete restrict,
  completed_at            timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,

  constraint ck_change_orders_title_not_blank check (btrim(title) <> ''),
  constraint ck_change_orders_cost_impact_safe_integer
    check (cost_impact_amount is null or cost_impact_amount between -999999999999999 and 999999999999999)
);

create index idx_change_orders_organization_id on change_orders (organization_id) where deleted_at is null;
create index idx_change_orders_project_id on change_orders (project_id) where deleted_at is null;
create index idx_change_orders_zone_id on change_orders (zone_id) where deleted_at is null;

comment on table change_orders is
  'Owned by modules/scope-variation. The Variation state machine (ARCHITECTURE.md 4.3, ADR 0012). cost_impact_amount may be negative (scope reduction) -- the one money column in this codebase without a non-negative check.';

alter table change_orders enable row level security;

-- Staff: full read/write within their org. The transition-graph trigger
-- below is what actually constrains which status changes succeed, not this
-- policy -- same split as Cash Gate's RLS-is-coarse, trigger-is-precise
-- pattern.
create policy change_orders_select_staff
  on change_orders for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy change_orders_insert_staff
  on change_orders for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy change_orders_update_staff
  on change_orders for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- client_approver: can see a variation once it has actually been sent to
-- them (never draft/under_review -- that is internal process, not something
-- to expose to a client), and can record their own decision. What they are
-- allowed to actually change is narrowed by
-- fn_change_orders_guard_client_columns below, not by this policy -- RLS
-- cannot express "this column but not that one" on one row (the exact
-- lesson ADR 0011 already cost us once).
create policy change_orders_select_client_approver
  on change_orders for select
  to authenticated
  using (
    fn_has_project_role(project_id, array['client_approver'])
    and status not in ('draft', 'under_review')
  );

create policy change_orders_update_client_approver
  on change_orders for update
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver']))
  with check (fn_has_project_role(project_id, array['client_approver']));

-- No DELETE policy for anyone. Soft delete (deleted_at) is the removal path,
-- same as every other project-scoped table.

select fn_install_standard_triggers('change_orders');

-- ===========================================================================
-- fn_change_orders_guard_transition -- mirrors modules/scope-variation's
-- TRANSITIONS graph exactly. Applies to every updater alike (staff and
-- client_approver both go through this).
-- ===========================================================================

create or replace function fn_change_orders_guard_transition()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'under_review') or
      (old.status = 'under_review' and new.status = 'awaiting_client_approval') or
      (old.status = 'under_review' and new.status = 'rejected') or
      (old.status = 'awaiting_client_approval' and new.status = 'approved_unpaid') or
      (old.status = 'awaiting_client_approval' and new.status = 'rejected') or
      (old.status = 'approved_unpaid' and new.status = 'approved_funded') or
      (old.status = 'approved_funded' and new.status = 'completed')
    ) then
      raise exception
        'Transisi status change_order dari % ke % tidak diperbolehkan', old.status, new.status
        using errcode = 'check_violation',
              hint = 'ARCHITECTURE.md 4.3, ADR 0012.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_change_orders_guard_transition() is
  'Database-layer mirror of modules/scope-variation/domain/transition.ts''s TRANSITIONS graph (ARCHITECTURE.md 0.2, 4.3).';

create trigger trg_change_orders_guard_transition
  before update of status on change_orders
  for each row execute function fn_change_orders_guard_transition();

-- ===========================================================================
-- fn_change_orders_guard_client_columns -- a client_approver's UPDATE may
-- only ever record their own decision (status + the client_approved_*/
-- rejected_* columns), never the money/schedule figures they are being
-- asked to approve or any other field. Same pattern as
-- fn_users_guard_privileged_columns (Wave 1): a real trigger doing the
-- column-level check RLS cannot express.
--
-- Staff (fn_current_org_role() is not null) are exempt -- this guard exists
-- for the one actor who should never touch these columns, not for staff,
-- who the transition-graph trigger already constrains sufficiently.
-- ===========================================================================

create or replace function fn_change_orders_guard_client_columns()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if fn_current_org_role() is not null then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.cost_impact_amount is distinct from old.cost_impact_amount
     or new.schedule_impact_days is distinct from old.schedule_impact_days
     or new.zone_id is distinct from old.zone_id
     or new.project_id is distinct from old.project_id
     or new.organization_id is distinct from old.organization_id
     or new.requested_by is distinct from old.requested_by
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.funded_by is distinct from old.funded_by
     or new.funded_at is distinct from old.funded_at
     or new.completed_by is distinct from old.completed_by
     or new.completed_at is distinct from old.completed_at
  then
    raise exception
      'A client approver may only record their own approve/reject decision, not other fields'
      using errcode = 'insufficient_privilege',
            hint = 'ADR 0012.';
  end if;

  return new;
end;
$$;

comment on function fn_change_orders_guard_client_columns() is
  'Restricts a client_approver''s UPDATE to their own decision columns only (ADR 0012) -- RLS cannot express column-level restrictions, so this is the precise check underneath the coarse row-level policy above.';

create trigger trg_change_orders_guard_client_columns
  before update on change_orders
  for each row execute function fn_change_orders_guard_client_columns();

-- ===========================================================================
-- work_packages.change_order_id -- a variation's resulting field work,
-- expand-only addition to the Fase 1 table (nullable, no data migration
-- needed). Deliberately additive rather than a new junction table: one work
-- package belongs to at most one change order, the same one-to-many shape
-- work_packages already has with zone_id/milestone_id.
-- ===========================================================================

alter table work_packages add column change_order_id uuid references change_orders (id) on delete restrict;

create index idx_work_packages_change_order_id on work_packages (change_order_id) where deleted_at is null;

comment on column work_packages.change_order_id is
  'Set only once the change order is approved_funded (ARCHITECTURE.md 4.3, ADR 0012) -- enforced by trg_work_packages_guard_change_order_funded, not just convention.';

create or replace function fn_work_packages_guard_change_order_funded()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_status change_order_status;
begin
  if new.change_order_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.change_order_id is not distinct from old.change_order_id then
    return new;
  end if;

  select status into v_status from change_orders where id = new.change_order_id;

  if v_status is distinct from 'approved_funded' then
    raise exception
      'A work package can only be linked to a change order once it is approved_funded (currently %)', v_status
      using errcode = 'check_violation',
            hint = 'ARCHITECTURE.md 4.3, ADR 0012.';
  end if;

  return new;
end;
$$;

comment on function fn_work_packages_guard_change_order_funded() is
  'Database-layer enforcement of ARCHITECTURE.md 4.3''s "work package variation only under approved_funded" rule -- the literal exit-criteria demo for Fase 3.';

create trigger trg_work_packages_guard_change_order_funded
  before insert or update of change_order_id on work_packages
  for each row execute function fn_work_packages_guard_change_order_funded();
