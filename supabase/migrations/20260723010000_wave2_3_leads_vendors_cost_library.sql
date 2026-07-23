-- Wave 2/3 (Fase 8): leads, vendors, cost_library (ARCHITECTURE.md 2.1, 8),
-- ADR 0018. Built now, out of wave-number order, same "this module's turn"
-- situation every prior phase's tables have also been in (client_decisions,
-- inspections, invoices before this).

create type lead_status as enum (
  'new',
  'contacted',
  'qualified',
  'assessment_scheduled',
  'proposal_sent',
  'won',
  'lost'
);

-- ===========================================================================
-- leads
--
-- Same two-layer principle as change_orders' own status graph (Fase 3):
-- fn_leads_guard_transition mirrors modules/crm/domain/lead-transition.ts's
-- TRANSITIONS graph, unbypassable by direct SQL. project_id is set once,
-- by convertLeadToProjectAction, the moment a lead reaches 'qualified'
-- (ADR 0018 SS2) -- not at 'won'.
-- ===========================================================================

create table leads (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete restrict,
  -- An existing repeat customer, if this lead came from one -- also a
  -- lead-scoring factor (ADR 0018 SS1).
  client_id             uuid references clients (id) on delete restrict,
  project_id            uuid references projects (id) on delete restrict,
  contact_name          text not null,
  email                 text,
  phone                 text,
  source                text,
  budget_known          boolean not null default false,
  desired_start_date    date,
  estimated_value       bigint,
  status                lead_status not null default 'new',
  lost_reason           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint ck_leads_contact_name_not_blank check (btrim(contact_name) <> ''),
  constraint ck_leads_email_format check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint ck_leads_estimated_value_non_negative check (estimated_value is null or estimated_value >= 0),
  constraint ck_leads_estimated_value_safe_integer check (estimated_value is null or estimated_value <= 999999999999999),
  constraint ck_leads_lost_reason_requires_lost check (status <> 'lost' or lost_reason is not null)
);

create index idx_leads_organization_id on leads (organization_id) where deleted_at is null;
create index idx_leads_client_id on leads (client_id) where deleted_at is null;
create index idx_leads_project_id on leads (project_id) where deleted_at is null;

comment on table leads is
  'Owned by modules/crm (ADR 0018). Pipeline: new -> contacted -> qualified -> assessment_scheduled -> proposal_sent -> won, with lost reachable from any stage before won. project_id is set once, at qualified, by convertLeadToProjectAction -- not at won.';

alter table leads enable row level security;

-- Staff-only, no project role at all -- same shape as quality-gate (Fase 5):
-- an internal sales/CRM tool, not something a field or client role reaches.
create policy leads_select_staff
  on leads for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy leads_insert_staff
  on leads for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy leads_update_staff
  on leads for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('leads');

create or replace function fn_leads_guard_transition()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'new' and new.status = 'contacted') or
      (old.status = 'contacted' and new.status = 'qualified') or
      (old.status = 'qualified' and new.status = 'assessment_scheduled') or
      (old.status = 'assessment_scheduled' and new.status = 'proposal_sent') or
      (old.status = 'proposal_sent' and new.status = 'won') or
      (new.status = 'lost' and old.status in ('new', 'contacted', 'qualified', 'assessment_scheduled', 'proposal_sent'))
    ) then
      raise exception
        'Transisi status lead dari % ke % tidak diperbolehkan', old.status, new.status
        using errcode = 'check_violation',
              hint = 'ARCHITECTURE.md 8, ADR 0018.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_leads_guard_transition() is
  'Database-layer mirror of modules/crm/domain/lead-transition.ts''s TRANSITIONS graph (ARCHITECTURE.md 0.2, ADR 0018).';

create trigger trg_leads_guard_transition
  before update of status on leads
  for each row execute function fn_leads_guard_transition();

-- ===========================================================================
-- vendors -- procurement master data, org-scoped.
-- ===========================================================================

create table vendors (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  name              text not null,
  contact_name      text,
  email             text,
  phone             text,
  address           text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_vendors_name_not_blank check (btrim(name) <> ''),
  constraint ck_vendors_email_format check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create index idx_vendors_organization_id on vendors (organization_id) where deleted_at is null;

comment on table vendors is 'Owned by modules/procurement. Supplier/subcontractor master data.';

alter table vendors enable row level security;

create policy vendors_select_staff
  on vendors for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy vendors_insert_staff
  on vendors for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy vendors_update_staff
  on vendors for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('vendors');

-- ===========================================================================
-- cost_library -- reusable unit-cost line items for estimating.
-- ===========================================================================

create table cost_library (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  name              text not null,
  unit              text not null,
  default_unit_cost bigint not null,
  category          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_cost_library_name_not_blank check (btrim(name) <> ''),
  constraint ck_cost_library_unit_not_blank check (btrim(unit) <> ''),
  constraint ck_cost_library_default_unit_cost_non_negative check (default_unit_cost >= 0),
  constraint ck_cost_library_default_unit_cost_safe_integer check (default_unit_cost <= 999999999999999)
);

create index idx_cost_library_organization_id on cost_library (organization_id) where deleted_at is null;

comment on table cost_library is
  'Owned by modules/estimating. Reusable unit-cost line items (internal -- harga beli/upah, ARCHITECTURE.md 2.6, never exposed to a client).';

alter table cost_library enable row level security;

create policy cost_library_select_staff
  on cost_library for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy cost_library_insert_staff
  on cost_library for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy cost_library_update_staff
  on cost_library for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('cost_library');

-- ===========================================================================
-- organizations gets a new column: the one org-wide margin floor (ADR 0018
-- SS4) -- additive ALTER, same shape as every prior phase's small additions
-- to an already-shipped table (work_packages.work_type, funding_receipts.invoice_id).
-- Basis points, default 0 (no floor until the owner sets one) -- a warning
-- threshold, not a hard rule, so no DB-level enforcement beyond storing it.
-- ===========================================================================

alter table organizations add column margin_floor_bp integer not null default 0;
alter table organizations add constraint ck_organizations_margin_floor_bp_range check (margin_floor_bp between 0 and 10000);
