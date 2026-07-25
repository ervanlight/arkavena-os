-- Fase 12 (ADR 0026 §4.2): a decision's client_decisions row must never
-- surface change_orders.title raw to a client -- that column is written by
-- staff for internal tracking and can read as jargon ("Variation #14 - RAB
-- revisi kabinet"). Adds an optional, staff-authored plain-language
-- sentence at the point a variation is actually sent to the client
-- (scope-variation's sendChangeOrderToClientAction), copied into
-- client_decisions by the same trigger that already creates that row --
-- client_decisions stays exactly as append-only-via-trigger as before this
-- migration (CLAUDE.md 2's "migration yang sudah applied tidak pernah
-- diedit"; this is a new migration, not an edit of Wave 7/8's).

alter table change_orders add column client_summary text;
comment on column change_orders.client_summary is
  'ADR 0026 §4.2: optional plain-language sentence staff write when presenting this variation to the client (e.g. "Pemilihan meja dapur menunggu konfirmasi Anda"), instead of the client ever seeing `title` raw. Copied into client_decisions.client_summary by fn_change_orders_sync_client_decision at the moment status enters awaiting_client_approval.';

alter table client_decisions add column client_summary text;
comment on column client_decisions.client_summary is
  'ADR 0026 §4.2. Copied once, from change_orders.client_summary, at insert time -- this table is a presentation log of what was asked, not a live mirror, so it is never re-synced afterward even if the source change_order''s client_summary changes later.';

create or replace function fn_change_orders_sync_client_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'awaiting_client_approval'
     and (tg_op = 'INSERT' or old.status is distinct from 'awaiting_client_approval') then
    insert into client_decisions (organization_id, project_id, change_order_id, presented_at, client_summary)
    values (new.organization_id, new.project_id, new.id, now(), new.client_summary);
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

-- Re-points vw_client_timeline_event's decision title at client_summary
-- first, falling back to the pre-existing co.title/'Keputusan' shape for any
-- decision row that predates this migration (client_summary null there).
create or replace view vw_client_timeline_event
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
  coalesce(cd.client_summary, co.title, 'Keputusan') as title,
  coalesce(cd.decided_at, cd.presented_at) as event_at,
  coalesce(cd.decision::text, 'menunggu') as status
from client_decisions cd
left join change_orders co on co.id = cd.change_order_id
where cd.deleted_at is null;

comment on view vw_client_timeline_event is
  'ADR 0016, amended by ADR 0026 §4.2. A single queryable timeline: milestone due dates + decided client_decisions, ordered by event_at at the query site. Decision title prefers client_summary (plain language) over the internal change_orders.title.';
