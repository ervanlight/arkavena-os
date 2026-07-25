-- Phase 3 milestone 3.1 (F6): client sign-off/acceptance record at handover.
-- WORKFLOW_REVIEW.md Step 7.4: "no client_decisions type exists for 'accept
-- handover'... there's no in-system equivalent of a signed handover/
-- acceptance document." IMPLEMENTATION_PRIORITIES.md's own words: "a new
-- client_decisions-style record type for handover acceptance" -- so this
-- extends client_decisions a third time, the same way F1's proposal_id
-- extension did, rather than a new table.
--
-- Unlike change_order/proposal, a handover has no single source row to
-- point to (handover_items is many rows per project, and the moment being
-- signed off is "this project's handover as a whole", not one item) --
-- handover_signoff is a boolean discriminator against the client_decisions
-- row's own project_id instead of a fourth nullable FK to nothing in
-- particular. decided_by and decision_reason are new columns on
-- client_decisions itself (not copied from a source table, because for
-- this decision type there is no source table row storing them) --
-- change_order_id/proposal_id decisions leave both null, since that
-- information already lives on change_orders.client_approved_by/rejected_by
-- and proposals.decided_by/decision_reason respectively.

alter table client_decisions add column handover_signoff boolean not null default false;
alter table client_decisions add column decided_by uuid references users (id) on delete restrict;
alter table client_decisions add column decision_reason text;

alter table client_decisions drop constraint ck_client_decisions_exactly_one_source;
alter table client_decisions add constraint ck_client_decisions_exactly_one_source
  check (
    (case when change_order_id is not null then 1 else 0 end)
    + (case when proposal_id is not null then 1 else 0 end)
    + (case when handover_signoff then 1 else 0 end)
    = 1
  );

comment on column client_decisions.handover_signoff is
  'Post-implementation Phase 3 (F6): true for a project-level handover acceptance decision -- discriminated against this row''s own project_id, since a handover has no single source row the way change_order_id/proposal_id point to one.';
comment on column client_decisions.decided_by is
  'Set only for handover_signoff rows -- change_order/proposal decisions already store who decided on their own source table (change_orders.client_approved_by/rejected_by, proposals.decided_by).';
comment on column client_decisions.decision_reason is
  'Set only for handover_signoff rows, for the same reason as decided_by above.';

-- ===========================================================================
-- fn_projects_sync_handover_signoff_decision -- opens a pending handover
-- sign-off the moment a project first reaches 'completed', the same trigger
-- point fn_projects_sync_warranties_on_completion already fires on (Wave 9).
-- A separate trigger, not folded into that one -- "one trigger, one job" is
-- the established convention every other sync trigger in this system
-- follows.
-- ===========================================================================

create or replace function fn_projects_sync_handover_signoff_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into client_decisions (organization_id, project_id, handover_signoff, presented_at, client_summary)
    values (new.organization_id, new.id, true, now(), 'Proyek Anda telah selesai -- mohon konfirmasi serah terima.');
  end if;
  return new;
end;
$$;

comment on function fn_projects_sync_handover_signoff_decision() is
  'Phase 3 (F6): opens a pending handover sign-off client_decisions row the moment a project first transitions to completed -- same "fires once, guarded by old.status is distinct from" discipline as fn_projects_sync_warranties_on_completion, which fires on the identical event.';

create trigger trg_projects_sync_handover_signoff_decision
  after update of status on projects
  for each row execute function fn_projects_sync_handover_signoff_decision();

-- ===========================================================================
-- client_decisions gains its first-ever write policy for a client role.
-- Every other client_decisions row (change_order_id/proposal_id) is
-- decided by mutating the SOURCE table (change_orders/proposals) -- the
-- sync trigger closes client_decisions as a side effect. A handover
-- sign-off has no source table, so client_decisions itself must be the
-- thing a client_approver can write to, for this one row shape only.
-- ===========================================================================

create policy client_decisions_update_client
  on client_decisions for update
  to authenticated
  using (handover_signoff and fn_has_project_role(project_id, array['client_approver']))
  with check (handover_signoff and fn_has_project_role(project_id, array['client_approver']));

comment on policy client_decisions_update_client on client_decisions is
  'The only client-writable slice of client_decisions: handover_signoff rows only, client_approver only. fn_client_decisions_guard_client_columns below restricts which columns, the same "coarse RLS + precise trigger" split as proposals_update_client/fn_proposals_guard_client_columns.';

create or replace function fn_client_decisions_guard_client_columns()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if fn_current_org_role() is not null then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.project_id is distinct from old.project_id
     or new.change_order_id is distinct from old.change_order_id
     or new.proposal_id is distinct from old.proposal_id
     or new.handover_signoff is distinct from old.handover_signoff
     or new.presented_at is distinct from old.presented_at
     or new.client_summary is distinct from old.client_summary
  then
    raise exception
      'A client approver may only record their own accept/reject decision, not other fields'
      using errcode = 'insufficient_privilege',
            hint = 'Phase 3 F6.';
  end if;

  return new;
end;
$$;

comment on function fn_client_decisions_guard_client_columns() is
  'Restricts a client_approver''s UPDATE of client_decisions to decision/decided_at/decided_by/decision_reason only -- same pattern as fn_proposals_guard_client_columns/fn_change_orders_guard_client_columns.';

create trigger trg_client_decisions_guard_client_columns
  before update on client_decisions
  for each row execute function fn_client_decisions_guard_client_columns();

-- No transition guard trigger needed here the way proposals/change_orders
-- have one: client_decisions.decision only ever moves from null to a value
-- once (ck_client_decisions_decision_requires_decided_at already ties
-- decision to decided_at), and fn_client_accept_handover below only ever
-- targets a row where decided_at is still null, so there is no multi-state
-- graph to guard.

-- ===========================================================================
-- fn_client_accept_handover -- the RPC modules/client-portal calls, plain
-- (security invoker, not definer): client_decisions_update_client RLS and
-- trg_client_decisions_guard_client_columns above are what actually enforce
-- this, same reasoning as fn_client_decide_proposal.
-- ===========================================================================

create or replace function fn_client_accept_handover(p_client_decision_id uuid, p_decision client_decision_outcome, p_reason text)
returns client_decisions
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_decision client_decisions;
begin
  update client_decisions
  set decision = p_decision,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = p_reason
  where id = p_client_decision_id
    and handover_signoff = true
    and decided_at is null
  returning * into v_decision;

  if v_decision.id is null then
    raise exception 'Serah terima % tidak ditemukan atau tidak dapat diakses', p_client_decision_id
      using errcode = 'no_data_found';
  end if;

  return v_decision;
end;
$$;

comment on function fn_client_accept_handover(uuid, client_decision_outcome, text) is
  'Phase 3 (F6). Plain (security invoker) RPC for a client_approver''s own handover accept/reject -- client_decisions_update_client RLS and trg_client_decisions_guard_client_columns keep enforcing exactly as they would for a raw UPDATE, unchanged by this function existing.';
