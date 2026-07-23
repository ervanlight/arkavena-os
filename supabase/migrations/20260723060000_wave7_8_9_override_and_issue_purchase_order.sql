-- The Fase 8 equivalent of fn_override_and_open_work_package
-- (20260721000700), anticipated by that migration's own comment: "Fase 8
-- adds the equivalent for purchase_orders when that table exists, not a
-- rewritten copy of this function." Same reasoning applies verbatim here --
-- a single Postgres function call is inherently one transaction, so
-- inserting the override row and the purchase_orders row inside one
-- function call guarantees atomicity without the application needing its
-- own transaction-spanning code.
--
-- Not SECURITY DEFINER: RLS on both tables (staff of the org) applies
-- naturally to the calling user, and trg_cash_gate_overrides_guard_owner_only
-- still fires as part of this same transaction, so "only an owner may
-- override" keeps holding exactly as it does for a standalone insert.
--
-- Unlike fn_override_and_open_work_package, there is no existing row to look
-- up organization_id/project_id from -- a PO is the issuance itself, not a
-- transition of a row that already exists. organization_id and project_id
-- are therefore parameters, not a lookup.

create or replace function fn_override_and_issue_purchase_order(
  p_organization_id uuid,
  p_project_id uuid,
  p_vendor_id uuid,
  p_description text,
  p_amount bigint,
  p_reason text,
  p_vendor_quote_id uuid default null
)
returns purchase_orders
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_purchase_order purchase_orders;
begin
  insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by)
  values (p_organization_id, p_project_id, 'issue_po', p_reason, (select auth.uid()));

  insert into purchase_orders (organization_id, project_id, vendor_id, vendor_quote_id, description, amount, issued_by)
  values (p_organization_id, p_project_id, p_vendor_id, p_vendor_quote_id, p_description, p_amount, (select auth.uid()))
  returning * into v_purchase_order;

  return v_purchase_order;
end;
$$;

comment on function fn_override_and_issue_purchase_order(uuid, uuid, uuid, text, bigint, text, uuid) is
  'ADR 0010/ADR 0018 SS6: inserts the override and issues the purchase order in one transaction. RLS and trg_cash_gate_overrides_guard_owner_only both still apply to the calling user -- this function grants no privilege of its own.';
