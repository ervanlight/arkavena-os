-- Wave 7: funding_receipts, cash_forecasts (ARCHITECTURE.md 2.1, Fase 2), plus
-- cash_gate_overrides (ADR 0010) and projects.risk_reserve_amount (ADR 0009
-- decision 4) -- neither has a home anywhere else in the document.
--
-- This is also where the money logic freeze (ARCHITECTURE.md 7, CHECKPOINT #2)
-- becomes real at the database layer: fn_cash_gate_status and the
-- work_packages trigger are the second enforcement layer for exactly the same
-- decision src/modules/cash-gate/domain/funding-coverage.ts makes in pure
-- TypeScript (ARCHITECTURE.md 0.2).
--
-- ADR 0009 records four scope decisions this file assumes throughout:
-- committedCosts is a literal 0 placeholder (Fase 8's procurement module owns
-- the real figure), the purchase_orders trigger is deferred to Fase 8 (only
-- work_packages is wired here), overdue is 7 days past a funding receipt's
-- expected_date with no cleared_at, and risk_reserve_amount lives on
-- projects, defaulting to 0.

create type cash_gate_status as enum ('green', 'yellow', 'red', 'overdue');

-- Mirrors evaluateGateAction's action union exactly (ARCHITECTURE.md 4.2) --
-- a code-controlled, fixed list, so a Postgres ENUM per ARCHITECTURE.md 2.3.
create type cash_gate_action as enum (
  'issue_po',
  'open_work_package',
  'mobilize_sub',
  'start_variation',
  'order_material'
);

-- ===========================================================================
-- projects.risk_reserve_amount (ADR 0009 decision 4)
--
-- Owner/Finance sets this manually per project; 0 means no buffer applies
-- until someone says otherwise. Same safe-integer ceiling as every other
-- money column (ADR 0008) -- this is exactly the kind of column that ADR
-- exists to make routine.
-- ===========================================================================

alter table projects
  add column risk_reserve_amount bigint not null default 0;

alter table projects
  add constraint ck_projects_risk_reserve_non_negative check (risk_reserve_amount >= 0);

alter table projects
  add constraint ck_projects_risk_reserve_safe_integer check (risk_reserve_amount <= 999999999999999);

comment on column projects.risk_reserve_amount is
  'Cash Gate risk buffer, bigint rupiah (ADR 0009 decision 4). Owner/Finance sets this manually; 0 is "no buffer configured", not a computed value.';

-- ===========================================================================
-- funding_receipts
--
-- Owner decision D5 (ARCHITECTURE.md 9): kas cleared is Finance's manual
-- entry, never an automated bank feed. expected_date is what the overdue
-- check (ADR 0009 decision 3) reads; cleared_at stays null until Finance
-- confirms the money actually landed.
-- ===========================================================================

create table funding_receipts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  milestone_id    uuid references milestones (id) on delete restrict,
  amount          bigint not null,
  expected_date   date not null,
  cleared_at      timestamptz,
  -- Finance's proof of transfer (D5). Storage wiring (path convention,
  -- signed URLs) arrives with core/storage in Fase 4 -- this column just
  -- reserves the fact that a proof exists, not how it is served yet.
  proof_path      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_funding_receipts_amount_non_negative check (amount >= 0),
  constraint ck_funding_receipts_amount_safe_integer check (amount <= 999999999999999)
);

create index idx_funding_receipts_organization_id on funding_receipts (organization_id) where deleted_at is null;
create index idx_funding_receipts_project_id on funding_receipts (project_id) where deleted_at is null;
-- Supports the overdue check's own query shape exactly (project_id, cleared_at
-- is null, expected_date comparison).
create index idx_funding_receipts_overdue_lookup
  on funding_receipts (project_id, expected_date)
  where deleted_at is null and cleared_at is null;

comment on table funding_receipts is
  'Owned by modules/cash-gate. Cash cleared from the client, entered manually by Finance (owner decision D5) -- never an automated bank feed. amount is bigint rupiah.';

alter table funding_receipts enable row level security;

-- Staff only, same reasoning as contracts/milestones (ARCHITECTURE.md 2.6):
-- this is money, kept away from client-facing and project-role reads.
create policy funding_receipts_select_staff
  on funding_receipts for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy funding_receipts_insert_staff
  on funding_receipts for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy funding_receipts_update_staff
  on funding_receipts for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- ===========================================================================
-- cash_forecasts
--
-- Projected cash need, not an actual transaction. next14DayNeeds
-- (ARCHITECTURE.md 4.2) sums these within a rolling 14-day window from
-- needed_by_date.
-- ===========================================================================

create table cash_forecasts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  project_id       uuid not null references projects (id) on delete restrict,
  work_package_id  uuid references work_packages (id) on delete restrict,
  needed_amount    bigint not null,
  needed_by_date   date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint ck_cash_forecasts_amount_non_negative check (needed_amount >= 0),
  constraint ck_cash_forecasts_amount_safe_integer check (needed_amount <= 999999999999999)
);

create index idx_cash_forecasts_organization_id on cash_forecasts (organization_id) where deleted_at is null;
-- Supports the next-14-day-needs aggregation exactly (project_id, date range).
create index idx_cash_forecasts_project_id_needed_by_date
  on cash_forecasts (project_id, needed_by_date)
  where deleted_at is null;

comment on table cash_forecasts is
  'Owned by modules/cash-gate. Projected cash need, not an actual transaction. needed_amount is bigint rupiah.';

alter table cash_forecasts enable row level security;

create policy cash_forecasts_select_staff
  on cash_forecasts for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy cash_forecasts_insert_staff
  on cash_forecasts for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy cash_forecasts_update_staff
  on cash_forecasts for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- ===========================================================================
-- cash_gate_overrides (ADR 0010)
--
-- One row per override: a one-shot authorization for a specific action on a
-- specific project, not a standing exemption. The application (override
-- server action) inserts this row and performs the gated mutation in the
-- same transaction. reason is not null -- there is no override without one.
-- ===========================================================================

create table cash_gate_overrides (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  action          cash_gate_action not null,
  reason          text not null,
  overridden_by   uuid not null references users (id) on delete restrict,
  created_at      timestamptz not null default now(),

  constraint ck_cash_gate_overrides_reason_not_blank check (btrim(reason) <> '')
);

create index idx_cash_gate_overrides_organization_id on cash_gate_overrides (organization_id);
-- Supports the trigger's own lookup exactly (project_id, action, recency).
create index idx_cash_gate_overrides_lookup on cash_gate_overrides (project_id, action, created_at desc);

comment on table cash_gate_overrides is
  'Owned by modules/cash-gate. One row per override -- a one-shot authorization for one action, valid 5 minutes from creation (ADR 0010), not a standing exemption. Append-only in practice: no UPDATE or DELETE policy exists for anyone.';

alter table cash_gate_overrides enable row level security;

-- Any staff may see the override history -- this is exactly the kind of
-- decision the audit trail exists to make visible, not to restrict further.
create policy cash_gate_overrides_select_staff
  on cash_gate_overrides for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- RLS is the first, coarse filter (any staff of this org); the trigger below
-- is the precise check (owner specifically), the same two-layer split as
-- fn_users_guard_privileged_columns for users.org_role.
create policy cash_gate_overrides_insert_staff
  on cash_gate_overrides for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- No UPDATE or DELETE policy for anyone. An override is a fact about what
-- happened, at the moment it happened -- editing or removing one after the
-- fact is exactly what an audit trail must not allow.

create or replace function fn_cash_gate_overrides_guard_owner_only()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_role org_role;
begin
  select org_role into v_role from users where id = new.overridden_by and deleted_at is null;

  if v_role is distinct from 'owner' then
    raise exception
      'Only an owner may override the Cash Gate'
      using errcode = 'insufficient_privilege',
            hint = 'ARCHITECTURE.md 4.2: override hanya valid dengan role Owner.';
  end if;

  return new;
end;
$$;

comment on function fn_cash_gate_overrides_guard_owner_only() is
  'Enforces ARCHITECTURE.md 4.2''s "role Owner" rule for overrides at the database layer, alongside requirePermission() at the application layer.';

create trigger trg_cash_gate_overrides_guard_owner_only
  before insert on cash_gate_overrides
  for each row execute function fn_cash_gate_overrides_guard_owner_only();

select fn_install_standard_triggers('funding_receipts');
select fn_install_standard_triggers('cash_forecasts');
-- cash_gate_overrides gets the audit trigger but not updated_at: the table has
-- no updated_at column at all (append-only, see above -- there is nothing to
-- ever update).
create trigger trg_cash_gate_overrides_audit
  after insert or update or delete on cash_gate_overrides
  for each row execute function fn_audit_row_change();

-- ===========================================================================
-- fn_cash_gate_status -- the domain decision, mirrored at the database layer
-- (ARCHITECTURE.md 0.2). Not security definer: every table it reads already
-- grants staff SELECT within their own organisation, so running as the
-- caller is sufficient, and it is the safer default after Wave 1's
-- security-definer bug (20260720000400) -- no reason to reach for the
-- riskier tool without a specific need for it.
--
-- Passing a project_id the caller cannot see fails closed rather than
-- leaking data: RLS filters the internal aggregation queries to nothing,
-- risk_reserve_amount reads as null, and the function returns a status
-- computed from zeros -- wrong to rely on, but never a cross-tenant leak.
-- ===========================================================================

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
  -- Overdue overrides the ratio entirely (ARCHITECTURE.md 4.5). ADR 0009
  -- decision 3: 7 days past expected_date with cleared_at still null.
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

  select p.risk_reserve_amount into v_risk_reserve from projects p where p.id = p_project_id;

  v_net_available := v_cleared_funds - v_committed_costs;
  v_total_need := v_next_14_day_needs + coalesce(v_risk_reserve, 0);

  -- Nothing needed at all is trivially covered -- green, not an error and not
  -- red. Mirrors core/money/rupiah.ts's ratioBp, which returns null for the
  -- same zero-denominator case and leaves the *caller* to decide what null
  -- means; here, the caller (this function) decides it means green.
  if v_total_need = 0 then
    return 'green';
  end if;

  -- Multiply before dividing, integer division throughout -- exactly
  -- core/money/rupiah.ts's ratioBp, so the two can never silently diverge in
  -- how they round. 11000/10000 are not read from a shared constant (SQL
  -- has no import), so a db test asserts they match
  -- CASH_GATE_GREEN_BP/CASH_GATE_YELLOW_FLOOR_BP exactly, the same way the
  -- org_role enum is asserted to match ORG_ROLES.
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
  'The Cash Gate decision, computed live from funding_receipts/cash_forecasts/projects.risk_reserve_amount. Mirrors src/modules/cash-gate/domain/funding-coverage.ts''s computeFundingCoverage exactly -- ARCHITECTURE.md 0.2''s two-layer enforcement. committedCosts is a placeholder 0 (ADR 0009) until Fase 8.';

-- ===========================================================================
-- The work_packages enforcement trigger (ARCHITECTURE.md 4.2). Only
-- work_packages is wired here -- purchase_orders is Fase 8 (ADR 0009
-- decision 1); Fase 8 attaches the same fn_cash_gate_status to it directly.
--
-- Fires on INSERT as well as UPDATE, not only UPDATE as ARCHITECTURE.md 4.2's
-- prose literally says: a work package inserted directly with
-- status = 'in_progress' would otherwise bypass the gate entirely, which
-- contradicts the whole point of enforcing this at the database layer
-- (ARCHITECTURE.md 0.2 -- the rule must hold even if the application shell
-- is bypassed).
-- ===========================================================================

create or replace function fn_work_packages_guard_cash_gate()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_status       cash_gate_status;
  v_has_override boolean;
begin
  if new.status is distinct from 'in_progress' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'in_progress' then
    return new; -- already in_progress; not a transition into it
  end if;

  v_status := fn_cash_gate_status(new.project_id);

  if v_status in ('red', 'overdue') then
    select exists (
      select 1 from cash_gate_overrides co
      where co.project_id = new.project_id
        and co.action = 'open_work_package'
        and co.created_at >= (now() - interval '5 minutes')
    ) into v_has_override;

    if not v_has_override then
      raise exception
        'Cash Gate %: pekerjaan tidak bisa dibuka sampai kas mencukupi, atau di-override oleh Owner dengan alasan', v_status
        using errcode = 'check_violation',
              hint = 'ARCHITECTURE.md 4.2, ADR 0010.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_work_packages_guard_cash_gate() is
  'ARCHITECTURE.md 4.2''s DB-layer Cash Gate enforcement for work_packages. Fires on the transition into status=in_progress, whether by INSERT or UPDATE. A red or overdue gate blocks the transition unless a matching cash_gate_overrides row exists from the last 5 minutes (ADR 0010).';

create trigger trg_work_packages_guard_cash_gate
  before insert or update on work_packages
  for each row execute function fn_work_packages_guard_cash_gate();
