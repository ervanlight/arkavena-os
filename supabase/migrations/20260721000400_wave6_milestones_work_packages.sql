-- Wave 6: milestones, work_packages (ARCHITECTURE.md 2.1, Fase 1 scope per
-- ADR 0007).
--
-- estimate_items and proposals are also nominally Wave 6, but both belong to
-- the estimating module -- Fase 8, same exclusion reason as Wave 2 and Wave 5.

create type milestone_status as enum ('pending', 'completed');
create type work_package_status as enum ('not_started', 'in_progress', 'completed');

-- ===========================================================================
-- milestones
--
-- Splits a contract's value into payment checkpoints. `amount` is money --
-- bigint, CLAUDE.md law 1. Fase 2's Cash Gate (funding_receipts) and Fase 7's
-- Billing both read this table; neither's logic exists yet, so status here is
-- deliberately just "pending/completed", not an invoicing state machine.
-- ===========================================================================

create table milestones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  contract_id     uuid not null references contracts (id) on delete restrict,
  name            text not null,
  amount          bigint not null,
  due_date        date,
  status          milestone_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_milestones_name_not_blank check (btrim(name) <> ''),
  constraint ck_milestones_amount_non_negative check (amount >= 0)
);

create index idx_milestones_organization_id on milestones (organization_id) where deleted_at is null;
create index idx_milestones_contract_id on milestones (contract_id) where deleted_at is null;

comment on table milestones is
  'Owned by modules/projects. Payment checkpoints within a contract. amount is bigint rupiah. Read by cash-gate (Fase 2) and billing (Fase 7) once those modules exist.';

alter table milestones enable row level security;

-- Staff only, matching contracts: a milestone amount is the same sensitive
-- money figure ARCHITECTURE.md 2.6 keeps away from client-facing reads.
create policy milestones_select_staff
  on milestones for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy milestones_insert_staff
  on milestones for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy milestones_update_staff
  on milestones for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- ===========================================================================
-- work_packages
--
-- The unit of work a mandor or site coordinator actually reports progress
-- against -- field-reporting (Fase 4) attaches daily_logs and progress_entries
-- to this table. zone_id and milestone_id are both nullable: a work package
-- need not belong to one specific zone, and need not be tied to a specific
-- payment milestone.
-- ===========================================================================

create table work_packages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  zone_id         uuid references zones (id) on delete restrict,
  milestone_id    uuid references milestones (id) on delete restrict,
  name            text not null,
  status          work_package_status not null default 'not_started',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_work_packages_name_not_blank check (btrim(name) <> '')
);

create index idx_work_packages_organization_id on work_packages (organization_id) where deleted_at is null;
create index idx_work_packages_project_id on work_packages (project_id) where deleted_at is null;
create index idx_work_packages_zone_id on work_packages (zone_id) where deleted_at is null;
create index idx_work_packages_milestone_id on work_packages (milestone_id) where deleted_at is null;

comment on table work_packages is
  'Owned by modules/projects. The unit of work field-reporting (Fase 4) attaches daily progress to. zone_id and milestone_id are optional on purpose.';

alter table work_packages enable row level security;

create policy work_packages_select_staff
  on work_packages for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- Unlike contracts/milestones, work_packages carries no money figure, so
-- project members reading their own assignment is safe -- and is exactly what
-- Fase 4's SiteFlow needs from a mandor or site coordinator.
create policy work_packages_select_member
  on work_packages for select
  to authenticated
  using (
    fn_has_project_role(
      project_id,
      array['site_coordinator', 'mandor', 'client_approver', 'client_viewer', 'supplier', 'subcontractor']
    )
  );

create policy work_packages_insert_staff
  on work_packages for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy work_packages_update_staff
  on work_packages for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('milestones');
select fn_install_standard_triggers('work_packages');
