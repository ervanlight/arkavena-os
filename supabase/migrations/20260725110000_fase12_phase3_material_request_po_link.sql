-- Phase 3 milestone 3.4 (F9): structural link between material request and
-- procurement fulfillment. WORKFLOW_REVIEW.md 3.4: "a material_requests row
-- in field-reporting has no verified structural link to a purchase_orders/
-- vendor_quotes row in procurement... a material request could be silently
-- dropped, or the office could order the same thing twice."
--
-- `vendor_quotes.material_request_id` already existed (Wave 7/8) -- the real
-- gap is a PO issued directly, with no vendor_quote_id at all (ADR 0018 §6
-- allows this), which had no way to reference the request it fulfills. Adds
-- the same nullable FK directly to `purchase_orders` (owned by
-- modules/procurement, since that is the table gaining the column), plus a
-- sync trigger that actually closes the loop: nothing today ever flips
-- material_requests.status to 'fulfilled', staff or automatic.

alter table purchase_orders add column material_request_id uuid references material_requests (id) on delete restrict;
create index idx_purchase_orders_material_request_id on purchase_orders (material_request_id) where deleted_at is null;

comment on column purchase_orders.material_request_id is
  'Phase 3 (F9): set directly when a PO is issued without a vendor quote (ADR 0018 §6); when issued from a quote, the request is normally already linked via vendor_quotes.material_request_id instead -- fn_purchase_orders_sync_material_request_status below checks both paths.';

-- ===========================================================================
-- fn_purchase_orders_sync_material_request_status -- the sixth instance of
-- the cross-module-sync-trigger pattern (after work_packages/change_orders,
-- change_orders/client_decisions, invoices/funding_receipts, leads/
-- assessments, projects/warranties+client_decisions). Resolves the request
-- either directly (purchase_orders.material_request_id) or indirectly
-- (purchase_orders.vendor_quote_id -> vendor_quotes.material_request_id),
-- and marks it fulfilled the moment a PO referencing it is issued -- closing
-- the "silently dropped or double-ordered" risk WORKFLOW_REVIEW.md names,
-- without requiring staff to remember a second manual step.
-- ===========================================================================

create or replace function fn_purchase_orders_sync_material_request_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_material_request_id uuid;
begin
  v_material_request_id := new.material_request_id;

  if v_material_request_id is null and new.vendor_quote_id is not null then
    select vq.material_request_id into v_material_request_id
    from vendor_quotes vq
    where vq.id = new.vendor_quote_id;
  end if;

  if v_material_request_id is not null then
    update material_requests
    set status = 'fulfilled'
    where id = v_material_request_id
      and status = 'requested';
  end if;

  return new;
end;
$$;

comment on function fn_purchase_orders_sync_material_request_status() is
  'Phase 3 (F9): marks a material_requests row fulfilled the moment a purchase_orders row referencing it (directly or via vendor_quotes.material_request_id) is issued. security definer because the issuing user (any procurement role) may not otherwise have write access to a row still scoped as field-reporting''s -- same reasoning as fn_leads_sync_assessment_project.';

create trigger trg_purchase_orders_sync_material_request_status
  after insert on purchase_orders
  for each row execute function fn_purchase_orders_sync_material_request_status();
