-- Wave 5: zones, contracts (ARCHITECTURE.md 2.1, Fase 1 scope per ADR 0007).
--
-- estimates is also nominally Wave 5, but the estimating module (cost_library,
-- estimates, estimate_items, proposals) is Fase 8 scope -- excluded here for
-- the same reason vendors/cost_library were excluded from Wave 2.
--
-- Both tables reference projects with ON DELETE RESTRICT, not CASCADE: unlike
-- project_members (a pure join with no meaning outside its project), a zone or
-- a contract is substantial enough that a hard delete of its project should
-- have to reckon with it explicitly rather than silently take it along.

create type contract_status as enum ('draft', 'active', 'completed', 'terminated');

-- ===========================================================================
-- zones
--
-- A physical or logical area of a project (a floor, a wing, a room group).
-- ZoneMap v1 (Fase 1's static per-zone floor plan) reads this table; nothing
-- about a zone's own shape depends on that UI existing yet.
-- ===========================================================================

create table zones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_zones_name_not_blank check (btrim(name) <> '')
);

create index idx_zones_organization_id on zones (organization_id) where deleted_at is null;
create index idx_zones_project_id on zones (project_id) where deleted_at is null;

comment on table zones is
  'Owned by modules/projects. A physical or logical area within a project. Read by ZoneMap v1.';

alter table zones enable row level security;

create policy zones_select_staff
  on zones for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy zones_select_member
  on zones for select
  to authenticated
  using (
    fn_has_project_role(
      project_id,
      array['site_coordinator', 'mandor', 'client_approver', 'client_viewer', 'supplier', 'subcontractor']
    )
  );

create policy zones_insert_staff
  on zones for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy zones_update_staff
  on zones for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- ===========================================================================
-- contracts
--
-- The contract value lives here as contract_amount -- money, so bigint,
-- CLAUDE.md law 1. This is the raw figure the Cash Gate (Fase 2) and Billing
-- (Fase 7) modules will read from later; nothing about the Funding Coverage
-- Ratio or invoicing rules is implemented yet.
-- ===========================================================================

create table contracts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  project_id       uuid not null references projects (id) on delete restrict,
  title            text not null,
  contract_amount  bigint not null,
  status           contract_status not null default 'draft',
  signed_date      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint ck_contracts_title_not_blank check (btrim(title) <> ''),
  constraint ck_contracts_amount_non_negative check (contract_amount >= 0)
);

create index idx_contracts_organization_id on contracts (organization_id) where deleted_at is null;
create index idx_contracts_project_id on contracts (project_id) where deleted_at is null;

comment on table contracts is
  'Owned by modules/projects. contract_amount is bigint rupiah -- CLAUDE.md law 1. milestones (Wave 6) split this figure into payment milestones.';

alter table contracts enable row level security;

-- Contract value is sensitive (ARCHITECTURE.md 2.6 keeps internal figures away
-- from client-facing reads), so project members get no SELECT policy here --
-- only staff. The client portal (Fase 6) will read contracts through a
-- vw_client_* view exposing only what is safe to show, not this table
-- directly.
create policy contracts_select_staff
  on contracts for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy contracts_insert_staff
  on contracts for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy contracts_update_staff
  on contracts for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('zones');
select fn_install_standard_triggers('contracts');
