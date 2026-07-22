-- Wave 8 (Fase 6): client_decisions (ARCHITECTURE.md 2.1, 2.6), ADR 0016.
--
-- client_decisions is a presentation/timeline log owned by
-- modules/client-portal, NOT a second state machine: change_orders.status
-- (Fase 3) remains the single source of truth for what actually happened.
-- This table is written exclusively by fn_change_orders_sync_client_decision
-- below (security definer, same pattern as fn_audit_row_change writing to
-- audit_logs) -- no INSERT/UPDATE/DELETE policy exists for any role, the
-- same "append-only via trigger, no direct DML" shape as audit_logs.

create type client_decision_outcome as enum ('approved', 'rejected');

create table client_decisions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  project_id       uuid not null references projects (id) on delete restrict,
  -- Nullable: the only decision source Fase 6 has is a change order, but a
  -- future decision type (not yet built) should not need a schema change.
  change_order_id  uuid references change_orders (id) on delete restrict,
  presented_at     timestamptz not null default now(),
  decided_at       timestamptz,
  decision         client_decision_outcome,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint ck_client_decisions_decision_requires_decided_at
    check ((decision is null) = (decided_at is null))
);

create index idx_client_decisions_organization_id on client_decisions (organization_id) where deleted_at is null;
create index idx_client_decisions_project_id on client_decisions (project_id) where deleted_at is null;
create index idx_client_decisions_change_order_id on client_decisions (change_order_id) where deleted_at is null;

comment on table client_decisions is
  'Owned by modules/client-portal (ADR 0016). A presentation/timeline log of decisions asked of a client -- change_orders.status is the real state machine (Fase 3); this table exists so the portal has one simple, auditable surface to query instead of interpreting another module''s status enum. Written exclusively by fn_change_orders_sync_client_decision.';

alter table client_decisions enable row level security;

create policy client_decisions_select_staff
  on client_decisions for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy client_decisions_select_client
  on client_decisions for select
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver', 'client_viewer']));

select fn_install_standard_triggers('client_decisions');

-- ===========================================================================
-- fn_change_orders_sync_client_decision -- the only writer of client_decisions.
--
-- Fires on change_orders (owned by modules/scope-variation): entering
-- awaiting_client_approval opens a new pending decision; leaving it into a
-- decided status closes the most recent open one. security definer because
-- the caller (often a client_approver, who has no write access to
-- client_decisions at all) must still be able to trigger this side effect --
-- same justification as fn_audit_row_change.
-- ===========================================================================

create or replace function fn_change_orders_sync_client_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'awaiting_client_approval'
     and (tg_op = 'INSERT' or old.status is distinct from 'awaiting_client_approval') then
    insert into client_decisions (organization_id, project_id, change_order_id, presented_at)
    values (new.organization_id, new.project_id, new.id, now());
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'awaiting_client_approval'
     and new.status is distinct from 'awaiting_client_approval' then
    update client_decisions
    set decided_at = now(),
        decision = case when new.status = 'rejected' then 'rejected' else 'approved' end::client_decision_outcome
    where change_order_id = new.id and decided_at is null;
  end if;

  return new;
end;
$$;

comment on function fn_change_orders_sync_client_decision() is
  'ADR 0016: keeps client_decisions (modules/client-portal) in sync with change_orders.status (modules/scope-variation) without either module reaching into the other''s TypeScript layer -- the same cross-module-via-SQL-trigger pattern fn_work_packages_guard_hold_point established in Fase 5.';

create trigger trg_change_orders_sync_client_decision
  after insert or update of status on change_orders
  for each row execute function fn_change_orders_sync_client_decision();

-- ===========================================================================
-- Client-scoped read policies the portal's views need but Fase 1/4 never
-- added, because nothing client-facing read these tables yet: contracts and
-- milestones (contract value, payment schedule) and photos (progress
-- evidence). Scoped to client_approver/client_viewer only -- unlike zones/
-- projects, there is no legitimate reason for supplier/subcontractor/mandor/
-- site_coordinator to see contract amounts or client-facing captions any
-- differently than they already can (photos_select_field already covers
-- field roles).
-- ===========================================================================

create policy contracts_select_client
  on contracts for select
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver', 'client_viewer']));

create policy milestones_select_client
  on milestones for select
  to authenticated
  using (
    exists (
      select 1 from contracts c
      where c.id = milestones.contract_id
        and fn_has_project_role(c.project_id, array['client_approver', 'client_viewer'])
    )
  );

create policy photos_select_client
  on photos for select
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver', 'client_viewer']));

-- ===========================================================================
-- vw_client_* views (ARCHITECTURE.md 2.6, ADR 0016) -- the only surface the
-- client portal reads. security_invoker = true: RLS on the underlying
-- tables (checked as the calling user, not the view owner) is what actually
-- gates access, matching every other enforcement in this schema being
-- RLS-first. Each view explicitly lists only client-safe columns and
-- filters deleted_at itself, so a caller never has to remember to.
-- ===========================================================================

create view vw_client_project_overview
with (security_invoker = true) as
select distinct on (p.id)
  p.id as project_id,
  p.organization_id,
  p.name as project_name,
  p.status,
  p.start_date,
  p.target_end_date,
  p.actual_end_date,
  c.title as contract_title,
  c.contract_amount
from projects p
left join contracts c on c.project_id = p.id and c.deleted_at is null
where p.deleted_at is null
order by p.id, c.created_at desc;

comment on view vw_client_project_overview is
  'ADR 0016. Client-safe project overview: no risk_reserve_amount, no internal notes, no estimates/cost_library. Most recent contract per project only.';

create view vw_client_zone_progress
with (security_invoker = true) as
with latest_progress as (
  select distinct on (pe.work_package_id)
    pe.work_package_id,
    pe.progress_percent
  from progress_entries pe
  where pe.deleted_at is null
  order by pe.work_package_id, pe.created_at desc
)
select
  z.id as zone_id,
  z.project_id,
  z.name as zone_name,
  coalesce(round(avg(lp.progress_percent)), 0)::integer as progress_percent
from zones z
left join work_packages wp on wp.zone_id = z.id and wp.deleted_at is null
left join latest_progress lp on lp.work_package_id = wp.id
where z.deleted_at is null
group by z.id, z.project_id, z.name;

comment on view vw_client_zone_progress is
  'ADR 0016. Feeds ZoneMap klien: average of each zone''s work packages'' latest reported progress_percent. No work_type, no hold-point/inspection detail -- a client sees progress move, not the QA mechanics behind it.';

create view vw_client_timeline_event
with (security_invoker = true) as
select
  c.project_id,
  'milestone'::text as event_type,
  m.id as source_id,
  m.name as title,
  coalesce(m.due_date::timestamptz, m.created_at) as event_at,
  m.status::text as status
from milestones m
join contracts c on c.id = m.contract_id and c.deleted_at is null
where m.deleted_at is null

union all

select
  cd.project_id,
  'decision'::text as event_type,
  cd.id as source_id,
  coalesce(co.title, 'Keputusan') as title,
  coalesce(cd.decided_at, cd.presented_at) as event_at,
  coalesce(cd.decision::text, 'menunggu') as status
from client_decisions cd
left join change_orders co on co.id = cd.change_order_id
where cd.deleted_at is null;

comment on view vw_client_timeline_event is
  'ADR 0016. A single queryable timeline: milestone due dates + decided client_decisions, ordered by event_at at the query site.';

create view vw_client_progress_photo
with (security_invoker = true) as
select
  ph.id as photo_id,
  ph.project_id,
  ph.zone_id,
  ph.storage_path,
  ph.thumbnail_path,
  ph.caption,
  ph.created_at,
  u.full_name as uploaded_by_name
from photos ph
join users u on u.id = ph.uploaded_by
where ph.deleted_at is null;

comment on view vw_client_progress_photo is
  'ADR 0016. Progress evidence: photos with the uploader resolved to a display name only, never a raw users.id a client has no other access to.';
