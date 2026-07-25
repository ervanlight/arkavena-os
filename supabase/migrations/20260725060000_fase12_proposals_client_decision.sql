-- Fase 12 (F1, ADR 0026 §5 amendment — see ADR 0026 §7 item 6): the client's
-- proposal accept/decline moment moves in-system. `proposals` (owned by
-- modules/estimating) stays Internal Only for its mechanism -- estimates,
-- estimate_items, cost_library, margin -- but the narrow decision surface
-- (status/decided_at/decided_by/decision_reason) is now Client Decision
-- Required, the exact same split `change_orders` already has (Wave 7).
--
-- Mirrors that wave's three pieces exactly: a client_summary column, a
-- client-scoped RLS pair, a transition guard (closing a pre-existing gap --
-- proposals never had one, even for staff, until a client could reach this
-- table), and a column guard restricting a client's UPDATE to the decision
-- columns only.

alter table proposals add column client_summary text;
comment on column proposals.client_summary is
  'ADR 0026 §5 amendment (2026-07-25): optional plain-language sentence staff write when sending this proposal to the client, the same client_summary pattern change_orders/client_decisions already established -- never the raw estimate breakdown.';

-- client_viewer may only read; client_approver may read and decide. Neither
-- ever sees a draft proposal -- that is internal process, not yet something
-- to expose (same reasoning as change_orders_select_client_approver).
create policy proposals_select_client
  on proposals for select
  to authenticated
  using (
    fn_has_project_role(project_id, array['client_approver', 'client_viewer'])
    and status <> 'draft'
  );

create policy proposals_update_client
  on proposals for update
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver']))
  with check (fn_has_project_role(project_id, array['client_approver']));

-- ===========================================================================
-- fn_proposals_guard_transition -- proposals had no DB-layer transition
-- guard at all before this migration (only the two CHECK constraints from
-- Wave 5/6); staff-only sendProposalAction/decideProposalAction enforced
-- ordering purely in the action layer. Now that a client_approver can also
-- reach this table's UPDATE, CLAUDE.md law §0.3's two-layer requirement
-- applies -- an external actor should never be one bug away from a status
-- the app layer alone was supposed to prevent.
-- ===========================================================================

create or replace function fn_proposals_guard_transition()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'sent') or
      (old.status = 'sent' and new.status = 'accepted') or
      (old.status = 'sent' and new.status = 'rejected')
    ) then
      raise exception
        'Transisi status proposal dari % ke % tidak diperbolehkan', old.status, new.status
        using errcode = 'check_violation',
              hint = 'ADR 0018 SS4-SS5, ADR 0026 §5 amendment.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_proposals_guard_transition() is
  'Database-layer mirror of the draft->sent->accepted/rejected ordering modules/estimating''s actions already enforce -- added when client_approver gained UPDATE access to this table (ADR 0026 §5 amendment).';

create trigger trg_proposals_guard_transition
  before update of status on proposals
  for each row execute function fn_proposals_guard_transition();

-- ===========================================================================
-- fn_proposals_guard_client_columns -- a client_approver's UPDATE may only
-- ever record their own decision, never client_summary (staff-authored),
-- estimate_id, or any other field. Same pattern as
-- fn_change_orders_guard_client_columns.
-- ===========================================================================

create or replace function fn_proposals_guard_client_columns()
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
     or new.estimate_id is distinct from old.estimate_id
     or new.sent_at is distinct from old.sent_at
     or new.client_summary is distinct from old.client_summary
  then
    raise exception
      'A client approver may only record their own accept/reject decision, not other fields'
      using errcode = 'insufficient_privilege',
            hint = 'ADR 0026 §5 amendment.';
  end if;

  return new;
end;
$$;

comment on function fn_proposals_guard_client_columns() is
  'Restricts a client_approver''s UPDATE to status/decided_at/decided_by/decision_reason only -- RLS cannot express column-level restrictions, so this is the precise check underneath proposals_update_client.';

create trigger trg_proposals_guard_client_columns
  before update on proposals
  for each row execute function fn_proposals_guard_client_columns();
