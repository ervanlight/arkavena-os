-- Wave 5/6 (Fase 8): estimates, estimate_items, proposals (ARCHITECTURE.md
-- 2.1, 8), ADR 0018 SS4-SS5. cost_library itself already exists (Wave 2,
-- F8-2) -- this migration only adds its line-item child and the two tables
-- above it in the wave chain.
--
-- estimates.assessment_id is one detail ARCHITECTURE.md's own wave list
-- flags but ADR 0018 does not explicitly resolve ("estimates -> projects,
-- assessments?", the same "?" annotation every prior phase's wave-list gaps
-- have turned out to mean "add the obvious nullable lineage column, no ADR
-- needed" -- e.g. leads.project_id, assessments.lead_id/project_id). Added
-- here as nullable, unset lineage back to whichever assessment informed the
-- estimate; nothing depends on it being present.

create type estimate_status as enum ('draft', 'sent', 'accepted', 'rejected', 'superseded');
create type proposal_status as enum ('draft', 'sent', 'accepted', 'rejected');

-- ===========================================================================
-- estimates
-- ===========================================================================

create table estimates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  assessment_id   uuid references assessments (id) on delete restrict,
  version         integer not null,
  is_baseline     boolean not null default false,
  status          estimate_status not null default 'draft',
  title           text not null,
  notes           text,
  created_by      uuid not null references users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_estimates_version_positive check (version > 0),
  constraint ck_estimates_title_not_blank check (btrim(title) <> '')
);

create unique index uq_estimates_project_version on estimates (project_id, version) where deleted_at is null;

-- The database itself makes "exactly one baseline per project" true
-- (CLAUDE.md 0.3) -- not application discipline alone (ADR 0018 SS4).
create unique index uq_estimates_one_baseline_per_project
  on estimates (project_id)
  where is_baseline and deleted_at is null;

create index idx_estimates_organization_id on estimates (organization_id) where deleted_at is null;
create index idx_estimates_project_id on estimates (project_id) where deleted_at is null;
create index idx_estimates_assessment_id on estimates (assessment_id) where deleted_at is null;

comment on table estimates is
  'Owned by modules/estimating (ADR 0018 SS4). version is an integer sequence per project (V1/V2/V3...); uq_estimates_one_baseline_per_project makes "exactly one baseline" a database fact. Margin is computed from estimate_items at read time, never stored here.';

alter table estimates enable row level security;

-- Staff-only: unit_cost on the child table is exactly the "harga beli, upah,
-- markup, margin" data ARCHITECTURE.md 2.6 says must never reach a table a
-- client reads -- estimates (the parent, no money columns of its own) gets
-- the same staff-only treatment as its child for one reason: title/notes
-- alone can still describe scope a client hasn't been formally shown yet.
create policy estimates_select_staff
  on estimates for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy estimates_insert_staff
  on estimates for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy estimates_update_staff
  on estimates for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('estimates');

-- ===========================================================================
-- estimate_items -- one line item, either against a cost_library entry or a
-- free-text description (a one-off item with no reusable library row yet).
-- ===========================================================================

create table estimate_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  estimate_id     uuid not null references estimates (id) on delete restrict,
  cost_library_id uuid references cost_library (id) on delete restrict,
  zone_id         uuid references zones (id) on delete restrict,
  description     text not null,
  unit            text not null,
  quantity        numeric(14, 3) not null,
  unit_cost       bigint not null,
  unit_price      bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_estimate_items_description_not_blank check (btrim(description) <> ''),
  constraint ck_estimate_items_unit_not_blank check (btrim(unit) <> ''),
  constraint ck_estimate_items_quantity_positive check (quantity > 0),
  constraint ck_estimate_items_unit_cost_non_negative check (unit_cost >= 0),
  constraint ck_estimate_items_unit_cost_safe_integer check (unit_cost <= 999999999999999),
  constraint ck_estimate_items_unit_price_non_negative check (unit_price >= 0),
  constraint ck_estimate_items_unit_price_safe_integer check (unit_price <= 999999999999999)
);

create index idx_estimate_items_organization_id on estimate_items (organization_id) where deleted_at is null;
create index idx_estimate_items_estimate_id on estimate_items (estimate_id) where deleted_at is null;
create index idx_estimate_items_cost_library_id on estimate_items (cost_library_id) where deleted_at is null;

comment on table estimate_items is
  'Owned by modules/estimating. unit_cost (internal, never client-visible, ARCHITECTURE.md 2.6) and unit_price (what the client is charged) both per-unit Rupiah bigint; margin is (sum(unit_price*qty) - sum(unit_cost*qty)) / sum(unit_price*qty), computed in modules/estimating/domain/margin.ts, never stored.';

alter table estimate_items enable row level security;

create policy estimate_items_select_staff
  on estimate_items for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy estimate_items_insert_staff
  on estimate_items for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy estimate_items_update_staff
  on estimate_items for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('estimate_items');

-- ===========================================================================
-- proposals -- a communication event about a sent estimate (ADR 0018 SS5).
-- decided_by/decision_reason mirror change_orders' own client-decision
-- columns (Fase 3) rather than reusing client_portal's client_decisions
-- table (deliberately scoped to change_orders only, ADR 0016). Staff-only
-- for v1: no client-portal UI is wired to proposals in this phase (Fase 8's
-- exit criterion is the internal lead -> assessment -> proposal -> kontrak
-- flow working, not a new client-facing surface) -- decided_by/
-- decision_reason record a staff member logging the client's decision
-- (meeting, email, phone), the same "recorded on the client's behalf" shape
-- assessments already have no client visibility at all.
-- ===========================================================================

create table proposals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  estimate_id     uuid not null references estimates (id) on delete restrict,
  status          proposal_status not null default 'draft',
  sent_at         timestamptz,
  decided_at      timestamptz,
  decided_by      uuid references users (id) on delete restrict,
  decision_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_proposals_sent_requires_sent_at check (status = 'draft' or sent_at is not null),
  constraint ck_proposals_decision_requires_decided_at
    check (
      status not in ('accepted', 'rejected')
      or (decided_at is not null and decided_by is not null and decision_reason is not null)
    )
);

-- "One per sent estimate" (ADR 0018 SS5's own heading) -- a revised estimate
-- gets a new version row (estimates.version) and therefore its own proposal,
-- never a second proposal against the same estimate_id.
create unique index uq_proposals_estimate_id on proposals (estimate_id) where deleted_at is null;

create index idx_proposals_organization_id on proposals (organization_id) where deleted_at is null;
create index idx_proposals_project_id on proposals (project_id) where deleted_at is null;

comment on table proposals is
  'Owned by modules/estimating (ADR 0018 SS5). One row per sent estimate (uq_proposals_estimate_id) -- a revised estimate is a new version with its own proposal, not a second row against the same estimate_id.';

alter table proposals enable row level security;

create policy proposals_select_staff
  on proposals for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy proposals_insert_staff
  on proposals for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy proposals_update_staff
  on proposals for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('proposals');
