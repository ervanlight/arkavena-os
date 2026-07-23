-- Wave 11: Partner Desk (Fase 11, ADR 0024). Adds vendor_users (mirrors
-- client_users), new supplier-scoped SELECT policies on modules/procurement's
-- existing vendor_quotes/purchase_orders/deliveries (additive -- RLS policies
-- are OR'd, so this changes nothing about existing staff-only access), and
-- three vw_partner_* views (security_invoker, same shape as Fase 6's
-- vw_client_* views) that are the only thing modules/partner-desk reads.

-- ===========================================================================
-- vendor_users
--
-- Owned by modules/procurement (it maps users to vendors, the table
-- procurement already owns -- same "owning module" reasoning as clients
-- owning client_users). Necessary here in a way client_users itself turned
-- out not to be: vendor_quotes/purchase_orders/deliveries are scoped by both
-- project_id and vendor_id, and two different suppliers can be `supplier`
-- project_members on the same project, so RLS needs the vendor identity link
-- to tell their rows apart (ADR 0024 SS5).
-- ===========================================================================

create table vendor_users (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendors (id) on delete cascade,
  user_id     uuid not null references users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_vendor_users_vendor_id_user_id unique (vendor_id, user_id)
);

-- CASCADE on vendor_id, not user_id: same reasoning as client_users -- this
-- row's only meaning is "this user represents this vendor". If the vendor
-- is hard-deleted the link goes with it; the user itself never disappears
-- silently.

create index idx_vendor_users_vendor_id on vendor_users (vendor_id);
create index idx_vendor_users_user_id on vendor_users (user_id);

comment on table vendor_users is
  'Owned by modules/procurement. Join between users and vendors -- a supplier contact''s identity, read by Partner Desk (Fase 11, ADR 0024) to scope vendor_quotes/purchase_orders/deliveries to their own vendor_id.';

alter table vendor_users enable row level security;

-- Scoped through vendors.organization_id, since vendor_users itself carries
-- no organization_id column -- one join, not a denormalised copy.
create policy vendor_users_select_staff
  on vendor_users for select
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from vendors v
      where v.id = vendor_users.vendor_id and v.organization_id = fn_current_org_id()
    )
  );

create policy vendor_users_select_self
  on vendor_users for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy vendor_users_insert_staff
  on vendor_users for insert
  to authenticated
  with check (
    fn_current_org_role() is not null
    and exists (
      select 1 from vendors v
      where v.id = vendor_users.vendor_id and v.organization_id = fn_current_org_id()
    )
  );

create policy vendor_users_delete_staff
  on vendor_users for delete
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from vendors v
      where v.id = vendor_users.vendor_id and v.organization_id = fn_current_org_id()
    )
  );

-- No UPDATE policy: same reasoning as client_users -- the only two columns
-- are the FKs themselves, changing either is "delete this link, make a
-- different one," not an edit.

select fn_install_standard_triggers('vendor_users');

-- ===========================================================================
-- Supplier-scoped SELECT policies on existing procurement tables
--
-- Additive: these are new policies alongside the existing *_select_staff
-- ones (ADR 0018), never replacing them. A supplier sees a row only if they
-- are a `supplier` project_member on its project AND their vendor_users row
-- matches the row's vendor_id.
-- ===========================================================================

-- organization_id = fn_current_org_id() is checked explicitly and separately
-- from fn_has_project_role/vendor_users -- neither of those two checks
-- constrains organization on its own (fn_has_project_role only matches
-- project_members rows regardless of org; vendor_users only matches
-- vendor_id). Confirmed necessary, not belt-and-suspenders: caught by
-- supabase/tests/partner-desk.test.ts's cross-org case failing without it.
create policy vendor_quotes_select_supplier
  on vendor_quotes for select
  to authenticated
  using (
    organization_id = fn_current_org_id()
    and fn_has_project_role(project_id, array['supplier'])
    and exists (
      select 1 from vendor_users vu
      where vu.vendor_id = vendor_quotes.vendor_id and vu.user_id = (select auth.uid())
    )
  );

create policy purchase_orders_select_supplier
  on purchase_orders for select
  to authenticated
  using (
    organization_id = fn_current_org_id()
    and fn_has_project_role(project_id, array['supplier'])
    and exists (
      select 1 from vendor_users vu
      where vu.vendor_id = purchase_orders.vendor_id and vu.user_id = (select auth.uid())
    )
  );

create policy deliveries_select_supplier
  on deliveries for select
  to authenticated
  using (
    organization_id = fn_current_org_id()
    and exists (
      select 1 from purchase_orders po
      join vendor_users vu on vu.vendor_id = po.vendor_id
      where po.id = deliveries.purchase_order_id
        and vu.user_id = (select auth.uid())
        and fn_has_project_role(po.project_id, array['supplier'])
    )
  );

-- ===========================================================================
-- vw_partner_* views (ARCHITECTURE.md 2.6, ADR 0024 SS5)
--
-- security_invoker = true: RLS on the underlying tables (the *_select_supplier
-- policies above) is what actually gates a row, not this view. Column list
-- excludes internal notes and internal staff-user references (issued_by,
-- received_by) -- the same "no raw internal detail to an external reader"
-- rule the client portal's own views already follow.
-- ===========================================================================

create view vw_partner_vendor_quotes
with (security_invoker = true) as
select
  id,
  project_id,
  vendor_id,
  material_request_id,
  description,
  amount,
  valid_until,
  status,
  created_at
from vendor_quotes
where deleted_at is null;

comment on view vw_partner_vendor_quotes is
  'ADR 0024. Partner-safe vendor_quotes: no notes, no organization_id. Supplier-only via vendor_quotes_select_supplier.';

create view vw_partner_purchase_orders
with (security_invoker = true) as
select
  id,
  project_id,
  vendor_id,
  vendor_quote_id,
  description,
  amount,
  created_at
from purchase_orders
where deleted_at is null;

comment on view vw_partner_purchase_orders is
  'ADR 0024. Partner-safe purchase_orders: no notes, no issued_by (internal staff identity). Supplier-only via purchase_orders_select_supplier.';

create view vw_partner_deliveries
with (security_invoker = true) as
select
  id,
  purchase_order_id,
  delivered_at,
  created_at
from deliveries
where deleted_at is null;

comment on view vw_partner_deliveries is
  'ADR 0024. Partner-safe deliveries: no notes, no received_by (internal staff identity). Supplier-only via deliveries_select_supplier.';
