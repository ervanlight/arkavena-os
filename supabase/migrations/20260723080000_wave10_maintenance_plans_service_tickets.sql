-- Wave 10 (Fase 9, modules/maintenance-engine): maintenance_plans,
-- service_tickets -- ADR 0019 SS5/SS6/SS7. Depends on assets (Wave 9),
-- hence the two-migration split even though both waves are one Fase 9
-- (ADR 0019 SS1).

-- ===========================================================================
-- maintenance_plans -- a fixed-interval recurrence per asset. next_due_date
-- is computed on read (interval_days from last_completed_at, or starts_at if
-- never completed) -- no scheduler/cron job exists in this stack, same
-- "computed advisory number" restraint as margin/aging/Decision Clock
-- (ADR 0019 SS5).
-- ===========================================================================

create table maintenance_plans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  asset_id          uuid not null references assets (id) on delete restrict,
  title             text not null,
  interval_days     integer not null,
  starts_at         date not null,
  last_completed_at date,
  is_active         boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_maintenance_plans_title_not_blank check (btrim(title) <> ''),
  constraint ck_maintenance_plans_interval_positive check (interval_days > 0)
);

create index idx_maintenance_plans_organization_id on maintenance_plans (organization_id) where deleted_at is null;
create index idx_maintenance_plans_asset_id on maintenance_plans (asset_id) where deleted_at is null;

comment on table maintenance_plans is
  'Owned by modules/maintenance-engine (ADR 0019 SS5). A fixed-interval recurrence per asset. next_due_date/overdue are computed at request time from interval_days + last_completed_at (or starts_at if never completed) -- no scheduled job writes or flips anything here.';

alter table maintenance_plans enable row level security;

create policy maintenance_plans_select_staff
  on maintenance_plans for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy maintenance_plans_insert_staff
  on maintenance_plans for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy maintenance_plans_update_staff
  on maintenance_plans for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('maintenance_plans');

-- ===========================================================================
-- service_tickets -- the actual work order (ADR 0019 SS6/SS7). Its own small
-- state machine, mirroring modules/maintenance-engine/domain/
-- service-ticket-transition.ts's TRANSITIONS graph exactly, unbypassable by
-- direct SQL (same two-layer split as leads/change_orders).
--
-- "Recurring inspection" (ADR 0019 SS7) is a service_tickets row opened from
-- a due maintenance_plans row -- maintenance_plan_id set, reported_by null.
-- No separate inspection mechanism.
-- ===========================================================================

create type service_ticket_status as enum ('open', 'in_progress', 'resolved', 'cancelled');

create table service_tickets (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete restrict,
  asset_id            uuid not null references assets (id) on delete restrict,
  client_id           uuid not null references clients (id) on delete restrict,
  warranty_id         uuid references warranties (id) on delete restrict,
  maintenance_plan_id uuid references maintenance_plans (id) on delete restrict,
  status              service_ticket_status not null default 'open',
  title               text not null,
  description         text,
  reported_by         uuid references users (id) on delete restrict,
  assigned_to         uuid references users (id) on delete restrict,
  resolved_at         timestamptz,
  resolution_notes    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint ck_service_tickets_title_not_blank check (btrim(title) <> ''),
  constraint ck_service_tickets_resolved_requires_resolved_at
    check (status <> 'resolved' or resolved_at is not null)
);

create index idx_service_tickets_organization_id on service_tickets (organization_id) where deleted_at is null;
create index idx_service_tickets_asset_id on service_tickets (asset_id) where deleted_at is null;
create index idx_service_tickets_client_id on service_tickets (client_id) where deleted_at is null;
create index idx_service_tickets_warranty_id on service_tickets (warranty_id) where deleted_at is null;
create index idx_service_tickets_maintenance_plan_id on service_tickets (maintenance_plan_id) where deleted_at is null;

comment on table service_tickets is
  'Owned by modules/maintenance-engine (ADR 0019 SS6/SS7). warranty_id only flags a claim -- it does not gate or compute anything, a human judges coverage. maintenance_plan_id set when a due plan opened this ticket (the "recurring inspection" of Fase 9''s exit criterion), null when a client reported an ad-hoc problem (reported_by set instead).';

alter table service_tickets enable row level security;

create policy service_tickets_select_staff
  on service_tickets for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy service_tickets_insert_staff
  on service_tickets for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy service_tickets_update_staff
  on service_tickets for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('service_tickets');

-- ===========================================================================
-- fn_service_tickets_guard_transition -- mirrors modules/maintenance-engine/
-- domain/service-ticket-transition.ts's TRANSITIONS graph, unbypassable by
-- direct SQL (ARCHITECTURE.md 0.2).
-- ===========================================================================

create or replace function fn_service_tickets_guard_transition()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status = 'in_progress') or
      (old.status = 'open' and new.status = 'cancelled') or
      (old.status = 'in_progress' and new.status = 'resolved') or
      (old.status = 'in_progress' and new.status = 'cancelled')
    ) then
      raise exception
        'Transisi status tiket servis dari "%" ke "%" tidak diperbolehkan', old.status, new.status
        using errcode = 'check_violation',
              hint = 'ADR 0019 SS6.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_service_tickets_guard_transition() is
  'Database-layer mirror of modules/maintenance-engine/domain/service-ticket-transition.ts''s TRANSITIONS graph (ARCHITECTURE.md 0.2, ADR 0019 SS6).';

create trigger trg_service_tickets_guard_transition
  before update of status on service_tickets
  for each row execute function fn_service_tickets_guard_transition();
