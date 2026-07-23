-- Wave 7/8/9 (Fase 8): vendor_quotes, purchase_orders, deliveries
-- (ARCHITECTURE.md 2.1, 8), ADR 0018 SS6. vendors (Wave 2, F8-2) and
-- material_requests (Wave 4, Fase 4/field-reporting) already exist --
-- this migration only adds the three tables procurement itself owns.
--
-- No separate rfqs table (ADR 0018 SS6, "alternatives considered"):
-- vendor_quotes is the concrete artifact "RFQ -> quote comparison"
-- produces, one row per vendor's response, optionally against a
-- material_requests row. purchase_orders.vendor_quote_id is nullable --
-- a PO can be issued from a compared quote or, for a simple/known-price
-- purchase, without ever going through one.
--
-- fn_purchase_orders_guard_cash_gate mirrors fn_work_packages_guard_cash_gate
-- (Wave 7, 20260721000600) exactly, per ADR 0018 SS6's own instruction: same
-- fn_cash_gate_status call, same cash_gate_overrides lookup (last 5 minutes),
-- same red/overdue block -- except it fires BEFORE INSERT only, since a
-- purchase_orders row IS the issuance (no separate draft status to
-- transition out of the way work_packages.status does). action = 'issue_po',
-- the cash_gate_action Fase 2 already reserved and left unused until now.
-- Zero changes to fn_cash_gate_status, cash_gate_overrides, or their trigger.

create type vendor_quote_status as enum ('received', 'accepted', 'rejected');

-- ===========================================================================
-- vendor_quotes -- one row per vendor's response to an RFQ. Staff-only, same
-- treatment as vendors/cost_library (F8-2): a quoted price is exactly the
-- kind of vendor-cost data ARCHITECTURE.md 2.6 keeps off any client-readable
-- table, and procurement has no client-portal surface in this phase.
-- ===========================================================================

create table vendor_quotes (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete restrict,
  project_id          uuid not null references projects (id) on delete restrict,
  vendor_id           uuid not null references vendors (id) on delete restrict,
  material_request_id uuid references material_requests (id) on delete restrict,
  description         text not null,
  amount              bigint not null,
  valid_until         date,
  status              vendor_quote_status not null default 'received',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint ck_vendor_quotes_description_not_blank check (btrim(description) <> ''),
  constraint ck_vendor_quotes_amount_non_negative check (amount >= 0),
  constraint ck_vendor_quotes_amount_safe_integer check (amount <= 999999999999999)
);

create index idx_vendor_quotes_organization_id on vendor_quotes (organization_id) where deleted_at is null;
create index idx_vendor_quotes_project_id on vendor_quotes (project_id) where deleted_at is null;
create index idx_vendor_quotes_vendor_id on vendor_quotes (vendor_id) where deleted_at is null;
create index idx_vendor_quotes_material_request_id on vendor_quotes (material_request_id) where deleted_at is null;

comment on table vendor_quotes is
  'Owned by modules/procurement (ADR 0018 SS6). One row per vendor''s response to an RFQ; material_request_id is nullable (a quote can be requested against a field material_request or asked for directly). amount is bigint rupiah, never client-visible (ARCHITECTURE.md 2.6).';

alter table vendor_quotes enable row level security;

create policy vendor_quotes_select_staff
  on vendor_quotes for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy vendor_quotes_insert_staff
  on vendor_quotes for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy vendor_quotes_update_staff
  on vendor_quotes for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('vendor_quotes');

-- ===========================================================================
-- purchase_orders -- Cash-Gate-guarded (ADR 0018 SS6). Staff-only, same
-- reasoning as funding_receipts/contracts: this is money.
-- ===========================================================================

create table purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid not null references projects (id) on delete restrict,
  vendor_id       uuid not null references vendors (id) on delete restrict,
  vendor_quote_id uuid references vendor_quotes (id) on delete restrict,
  description     text not null,
  amount          bigint not null,
  issued_by       uuid not null references users (id) on delete restrict,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_purchase_orders_description_not_blank check (btrim(description) <> ''),
  constraint ck_purchase_orders_amount_non_negative check (amount >= 0),
  constraint ck_purchase_orders_amount_safe_integer check (amount <= 999999999999999)
);

create index idx_purchase_orders_organization_id on purchase_orders (organization_id) where deleted_at is null;
create index idx_purchase_orders_project_id on purchase_orders (project_id) where deleted_at is null;
create index idx_purchase_orders_vendor_id on purchase_orders (vendor_id) where deleted_at is null;
create index idx_purchase_orders_vendor_quote_id on purchase_orders (vendor_quote_id) where deleted_at is null;

comment on table purchase_orders is
  'Owned by modules/procurement (ADR 0018 SS6). vendor_quote_id is nullable -- a PO can be issued from a compared quote or directly, for a simple/known-price purchase. Guarded by trg_purchase_orders_guard_cash_gate (BEFORE INSERT): a red/overdue Cash Gate blocks issuance unless a cash_gate_overrides row (action=issue_po) exists from the last 5 minutes.';

alter table purchase_orders enable row level security;

create policy purchase_orders_select_staff
  on purchase_orders for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy purchase_orders_insert_staff
  on purchase_orders for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy purchase_orders_update_staff
  on purchase_orders for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('purchase_orders');

-- ===========================================================================
-- fn_purchase_orders_guard_cash_gate -- mirrors fn_work_packages_guard_cash_gate
-- (20260721000600) exactly, adapted for a table with no status column to
-- transition: every INSERT on purchase_orders IS the gated action, so the
-- guard fires unconditionally on insert rather than only on a transition
-- into a particular status.
-- ===========================================================================

create or replace function fn_purchase_orders_guard_cash_gate()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_status       cash_gate_status;
  v_has_override boolean;
begin
  v_status := fn_cash_gate_status(new.project_id);

  if v_status in ('red', 'overdue') then
    select exists (
      select 1 from cash_gate_overrides co
      where co.project_id = new.project_id
        and co.action = 'issue_po'
        and co.created_at >= (now() - interval '5 minutes')
    ) into v_has_override;

    if not v_has_override then
      raise exception
        'Cash Gate %: PO tidak bisa diterbitkan sampai kas mencukupi, atau di-override oleh Owner dengan alasan', v_status
        using errcode = 'check_violation',
              hint = 'ARCHITECTURE.md 4.2, ADR 0010, ADR 0018 SS6.';
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_purchase_orders_guard_cash_gate() is
  'ARCHITECTURE.md 4.2''s DB-layer Cash Gate enforcement for purchase_orders (ADR 0018 SS6). Fires on every INSERT -- there is no status to transition into, the row itself is the issuance. A red or overdue gate blocks it unless a matching cash_gate_overrides row (action=issue_po) exists from the last 5 minutes (ADR 0010).';

create trigger trg_purchase_orders_guard_cash_gate
  before insert on purchase_orders
  for each row execute function fn_purchase_orders_guard_cash_gate();

-- ===========================================================================
-- deliveries -- a simple receipt record against a PO (ADR 0018 SS6). No
-- partial-delivery quantity tracking in v1: a PO is either undelivered or
-- has one or more delivery records against it. Staff-only, same as the rest
-- of procurement -- no field-role or client surface in this phase.
-- ===========================================================================

create table deliveries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  purchase_order_id uuid not null references purchase_orders (id) on delete restrict,
  delivered_at      timestamptz not null default now(),
  received_by       uuid not null references users (id) on delete restrict,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index idx_deliveries_organization_id on deliveries (organization_id) where deleted_at is null;
create index idx_deliveries_purchase_order_id on deliveries (purchase_order_id) where deleted_at is null;

comment on table deliveries is
  'Owned by modules/procurement (ADR 0018 SS6). A simple receipt record against a purchase_order -- no partial-delivery quantity tracking in v1; a PO is either undelivered or has one or more delivery records against it.';

alter table deliveries enable row level security;

create policy deliveries_select_staff
  on deliveries for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy deliveries_insert_staff
  on deliveries for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy deliveries_update_staff
  on deliveries for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('deliveries');
