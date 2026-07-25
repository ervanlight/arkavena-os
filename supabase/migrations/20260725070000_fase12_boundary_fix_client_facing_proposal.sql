-- Post-implementation review fix (C1, ADR 0026 §7 item 7): F1 originally had
-- client-portal's app routes and modules/estimating/actions/proposal-actions.ts
-- import each other directly (getProposalAction, listProposalsForProjectAction,
-- clientDecideProposalAction consumed straight from `@/modules/estimating`).
-- ARCHITECTURE.md 1.2 (F25) forbids exactly this: "client-portal tidak boleh
-- mengimpor cash-gate atau estimating secara langsung... setiap data yang
-- sampai ke klien dari kedua modul ini wajib lewat vw_client_* view atau
-- lapisan terjemahan eksplisit."
--
-- The chosen fix (Owner-confirmed: keep F25 absolute, adjust implementation)
-- extends `client_decisions` -- already designed for exactly this ("a future
-- decision type... should not need a schema change", Wave 8's own comment on
-- change_order_id) -- to also mirror proposal decisions, the same way it
-- already mirrors change_order decisions. `client-portal` never touches
-- `proposals` directly for reads. For the one write client-portal must still
-- cause (the client's own accept/reject), `fn_client_decide_proposal` is the
-- explicit, narrow RPC surface: a named database procedure, not a
-- TypeScript import across the module boundary -- the same reasoning
-- `fn_override_evidence_gate` already established for a cross-cutting
-- mutation.

alter table client_decisions add column proposal_id uuid references proposals (id) on delete restrict;
create index idx_client_decisions_proposal_id on client_decisions (proposal_id) where deleted_at is null;

alter table client_decisions add constraint ck_client_decisions_exactly_one_source
  check ((change_order_id is not null) <> (proposal_id is not null));

comment on column client_decisions.proposal_id is
  'Post-implementation review fix (C1): the decision-source column Wave 8''s own comment on change_order_id anticipated ("a future decision type... should not need a schema change"). Written exclusively by fn_proposals_sync_client_decision, mirroring change_order_id/fn_change_orders_sync_client_decision exactly.';

-- ===========================================================================
-- fn_proposals_sync_client_decision -- mirrors fn_change_orders_sync_client_decision
-- exactly (Wave 8), just sourced from proposals/proposal_status instead of
-- change_orders/change_order_status.
-- ===========================================================================

create or replace function fn_proposals_sync_client_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'sent'
     and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    insert into client_decisions (organization_id, project_id, proposal_id, presented_at, client_summary)
    values (new.organization_id, new.project_id, new.id, now(), new.client_summary);
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'sent'
     and new.status is distinct from 'sent' then
    update client_decisions
    set decided_at = now(),
        decision = case when new.status = 'rejected' then 'rejected' else 'approved' end::client_decision_outcome
    where proposal_id = new.id and decided_at is null;
  end if;

  return new;
end;
$$;

comment on function fn_proposals_sync_client_decision() is
  'Post-implementation review fix (C1). Keeps client_decisions in sync with proposals.status, the same cross-module-via-SQL-trigger pattern fn_change_orders_sync_client_decision already established -- client-portal never reads proposals directly to know a decision is pending.';

create trigger trg_proposals_sync_client_decision
  after insert or update of status on proposals
  for each row execute function fn_proposals_sync_client_decision();

-- ===========================================================================
-- fn_proposals_sync_estimate_status -- proposals.status and its estimate's
-- status were kept in sync by modules/estimating's own TypeScript actions
-- (sendProposalAction, decideProposalAction) calling updateEstimate()
-- explicitly. That still works for staff. It cannot work for a
-- client_approver deciding through fn_client_decide_proposal below --
-- estimates_update_staff requires fn_current_org_role() is not null, which a
-- client_approver never has. A trigger closes this regardless of who
-- changed proposals.status, the same "caller often lacks direct write
-- access, must still trigger the side effect" reasoning as
-- fn_change_orders_sync_client_decision.
-- ===========================================================================

create or replace function fn_proposals_sync_estimate_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    update estimates set status = new.status::text::estimate_status where id = new.estimate_id;
  end if;
  return new;
end;
$$;

comment on function fn_proposals_sync_estimate_status() is
  'Post-implementation review fix (C1): keeps estimates.status mirroring proposals.status (ADR 0018 SS4-SS5) regardless of caller -- needed once a client_approver, who has no write access to estimates at all, can change proposals.status through fn_client_decide_proposal.';

create trigger trg_proposals_sync_estimate_status
  after update of status on proposals
  for each row execute function fn_proposals_sync_estimate_status();

-- ===========================================================================
-- fn_client_decide_proposal -- the one write client-portal must still cause.
-- Deliberately NOT security definer: proposals_update_client (RLS, already
-- built for F1) and trg_proposals_guard_transition/
-- trg_proposals_guard_client_columns (already built for F1) are what
-- actually enforce who may decide what -- all three keep applying exactly
-- as before, checked against the calling client's own session, unchanged.
-- This function only saves client-portal from having to reference the
-- `proposals` table by name at all (CLAUDE.md 1: "dilarang query langsung
-- tabel milik modul lain") -- a named RPC, called by string identifier, is
-- not a TypeScript import across the client-portal/estimating boundary,
-- the same reasoning modules/evidence's own fn_override_evidence_gate
-- already established for a cross-cutting mutation.
-- ===========================================================================

create or replace function fn_client_decide_proposal(p_proposal_id uuid, p_decision proposal_status, p_reason text)
returns proposals
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_proposal proposals;
begin
  update proposals
  set status = p_decision,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = p_reason
  where id = p_proposal_id
  returning * into v_proposal;

  if v_proposal.id is null then
    raise exception 'Proposal % tidak ditemukan atau tidak dapat diakses', p_proposal_id
      using errcode = 'no_data_found';
  end if;

  return v_proposal;
end;
$$;

comment on function fn_client_decide_proposal(uuid, proposal_status, text) is
  'Post-implementation review fix (C1). Plain (security invoker) RPC: proposals_update_client RLS + trg_proposals_guard_transition + trg_proposals_guard_client_columns enforce the actual rules, unchanged from F1. Returns 0 rows found as an explicit error rather than the silent no-op a raw filtered UPDATE would have, since this is now the only path a client_approver has to attempt a decision.';
