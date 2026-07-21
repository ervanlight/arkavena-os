-- ADR 0011 (expand step): risk_reserve_amount moves off `projects` into its
-- own staff-only table, owned outright by modules/cash-gate.
--
-- `projects` has carried a second SELECT policy since Wave 4
-- (projects_select_member) granting every project role -- including the
-- external, client-facing ones (client_viewer, client_approver, supplier,
-- subcontractor) -- full-row read access to any project they belong to. RLS
-- is row-level, not column-level, so risk_reserve_amount living on that table
-- (added in 20260721000600) was readable by those same external roles, in
-- direct conflict with CLAUDE.md 2's "sensitive data never on a
-- client-readable table" -- exactly the reasoning that already kept
-- contracts/milestones off the project-role SELECT list entirely.
--
-- This migration creates the replacement table and backfills it. The next
-- migration (20260721000900) drops the old column once nothing reads it.

create table project_risk_reserves (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations (id) on delete restrict,
  project_id           uuid not null references projects (id) on delete restrict,
  risk_reserve_amount  bigint not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,

  constraint uq_project_risk_reserves_project_id unique (project_id),
  constraint ck_project_risk_reserves_amount_non_negative check (risk_reserve_amount >= 0),
  constraint ck_project_risk_reserves_amount_safe_integer check (risk_reserve_amount <= 999999999999999)
);

create index idx_project_risk_reserves_organization_id
  on project_risk_reserves (organization_id)
  where deleted_at is null;

comment on table project_risk_reserves is
  'Owned by modules/cash-gate. One row per project, risk_reserve_amount is bigint rupiah (ADR 0009 decision 4, moved off projects by ADR 0011). Owner/Finance sets this manually; 0 is "no buffer configured", not a computed value.';

alter table project_risk_reserves enable row level security;

-- Staff only -- no project-role policy at all, same reasoning as
-- contracts/milestones/funding_receipts/cash_forecasts: this is money, kept
-- away from client-facing and project-role reads (the whole point of ADR 0011).
create policy project_risk_reserves_select_staff
  on project_risk_reserves for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy project_risk_reserves_insert_staff
  on project_risk_reserves for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy project_risk_reserves_update_staff
  on project_risk_reserves for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('project_risk_reserves');

-- Backfill: one row per existing project, carrying over whatever value it
-- already had (every row is currently 0 -- no Owner/Finance user has had a
-- UI to set one yet -- but this copies the real column rather than assuming
-- that).
insert into project_risk_reserves (organization_id, project_id, risk_reserve_amount)
select organization_id, id, risk_reserve_amount
from projects;

-- fn_cash_gate_status now reads the risk reserve from its new home. Redefined
-- here (append-only migrations mean a new file, not an edit to
-- 20260721000600) with everything unchanged except the one lookup --
-- committedCosts placeholder, overdue window, and basis-point thresholds are
-- untouched.
create or replace function fn_cash_gate_status(p_project_id uuid)
returns cash_gate_status
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_overdue           boolean;
  v_cleared_funds     bigint;
  v_committed_costs   bigint := 0; -- ADR 0009 decision 2: placeholder until Fase 8's procurement module exists
  v_next_14_day_needs bigint;
  v_risk_reserve      bigint;
  v_net_available     bigint;
  v_total_need        bigint;
  v_ratio_bp          bigint;
begin
  select exists (
    select 1 from funding_receipts fr
    where fr.project_id = p_project_id
      and fr.deleted_at is null
      and fr.cleared_at is null
      and fr.expected_date < (current_date - 7)
  ) into v_overdue;

  if v_overdue then
    return 'overdue';
  end if;

  select coalesce(sum(fr.amount), 0) into v_cleared_funds
  from funding_receipts fr
  where fr.project_id = p_project_id and fr.deleted_at is null and fr.cleared_at is not null;

  select coalesce(sum(cf.needed_amount), 0) into v_next_14_day_needs
  from cash_forecasts cf
  where cf.project_id = p_project_id
    and cf.deleted_at is null
    and cf.needed_by_date between current_date and (current_date + 14);

  select prr.risk_reserve_amount into v_risk_reserve
  from project_risk_reserves prr
  where prr.project_id = p_project_id and prr.deleted_at is null;

  v_net_available := v_cleared_funds - v_committed_costs;
  v_total_need := v_next_14_day_needs + coalesce(v_risk_reserve, 0);

  if v_total_need = 0 then
    return 'green';
  end if;

  v_ratio_bp := (v_net_available * 10000) / v_total_need;

  if v_ratio_bp >= 11000 then
    return 'green';
  elsif v_ratio_bp >= 10000 then
    return 'yellow';
  else
    return 'red';
  end if;
end;
$$;

comment on function fn_cash_gate_status(uuid) is
  'The Cash Gate decision, computed live from funding_receipts/cash_forecasts/project_risk_reserves. Mirrors src/modules/cash-gate/domain/funding-coverage.ts''s computeFundingCoverage exactly -- ARCHITECTURE.md 0.2''s two-layer enforcement. committedCosts is a placeholder 0 (ADR 0009) until Fase 8. Risk reserve moved off projects to its own table by ADR 0011.';
