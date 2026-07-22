-- Wave 8/9 (Fase 7): invoices, payments (ARCHITECTURE.md 2.1, 7), ADR 0017.
--
-- Same two-layer principle as every prior critical module (CLAUDE.md 0.3):
-- the issuance guard lives here as a trigger, unbypassable by direct SQL,
-- mirroring modules/billing/domain's own eligibility check (advisory, for
-- the UI) exactly the way fn_work_packages_guard_hold_point (Fase 5)
-- mirrors canProceed().

create type invoice_status as enum ('draft', 'issued', 'paid', 'cancelled');

-- ===========================================================================
-- invoices
--
-- No "overdue" status: computed at read time (ADR 0017 SS1), same choice
-- ARCHITECTURE.md 4.2 already made for Cash Gate -- there is no job
-- scheduler in this project to flip a stored status over time.
-- ===========================================================================

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  project_id        uuid not null references projects (id) on delete restrict,
  milestone_id      uuid not null references milestones (id) on delete restrict,
  -- Set only when this invoice specifically bills a variation's additional
  -- cost -- fn_invoices_guard_issuance requires that change order already
  -- be approved_funded before this invoice may issue.
  change_order_id   uuid references change_orders (id) on delete restrict,
  title             text not null,
  amount            bigint not null,
  due_date          date not null,
  status            invoice_status not null default 'draft',

  created_by        uuid not null references users (id) on delete restrict,
  approved_by       uuid references users (id) on delete restrict,
  approved_at       timestamptz,
  issued_at         timestamptz,
  cancelled_by      uuid references users (id) on delete restrict,
  cancelled_at      timestamptz,
  cancelled_reason  text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_invoices_title_not_blank check (btrim(title) <> ''),
  constraint ck_invoices_amount_positive check (amount > 0),
  constraint ck_invoices_amount_safe_integer check (amount <= 999999999999999)
);

create index idx_invoices_organization_id on invoices (organization_id) where deleted_at is null;
create index idx_invoices_project_id on invoices (project_id) where deleted_at is null;
create index idx_invoices_milestone_id on invoices (milestone_id) where deleted_at is null;
create index idx_invoices_change_order_id on invoices (change_order_id) where deleted_at is null;

comment on table invoices is
  'Owned by modules/billing (ADR 0017). "Overdue" is computed, not stored -- issued + due_date passed + not fully paid. Issuing (status -> issued) requires milestone completed + QC clean + variation funded (if change_order_id set) + Technical Director approval, enforced by fn_invoices_guard_issuance.';

alter table invoices enable row level security;

create policy invoices_select_staff
  on invoices for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy invoices_insert_staff
  on invoices for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy invoices_update_staff
  on invoices for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- Client sees its own project's invoices once issued -- never a draft (an
-- unissued invoice is internal process, not something to expose to a
-- client, same reasoning as change_orders_select_client_approver excluding
-- draft/under_review). No margin/cost columns exist on this table at all,
-- so ARCHITECTURE.md 2.4's "tanpa kolom margin" is satisfied trivially.
create policy invoices_select_client
  on invoices for select
  to authenticated
  using (
    fn_has_project_role(project_id, array['client_approver', 'client_viewer'])
    and status <> 'draft'
  );

select fn_install_standard_triggers('invoices');

-- ===========================================================================
-- payments -- an append-only ledger against an invoice. No UPDATE/DELETE
-- policy for anyone: a recorded payment is a fact, corrected (if ever
-- needed) by a new row, not an edit -- same append-only shape as audit_logs.
-- ===========================================================================

create table payments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete restrict,
  invoice_id        uuid not null references invoices (id) on delete restrict,
  amount            bigint not null,
  paid_at           timestamptz not null default now(),
  -- Finance's proof of transfer, same column shape as funding_receipts.proof_path (D5).
  proof_path        text,
  recorded_by       uuid not null references users (id) on delete restrict,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint ck_payments_amount_positive check (amount > 0),
  constraint ck_payments_amount_safe_integer check (amount <= 999999999999999)
);

create index idx_payments_organization_id on payments (organization_id) where deleted_at is null;
create index idx_payments_invoice_id on payments (invoice_id) where deleted_at is null;

comment on table payments is
  'Owned by modules/billing (ADR 0017). Append-only against an invoice. When the sum for an invoice reaches its amount, fn_payments_sync_invoice_paid marks the invoice paid and clears the funding_receipts row fn_invoices_sync_funding_receipt created.';

alter table payments enable row level security;

create policy payments_select_staff
  on payments for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy payments_insert_staff
  on payments for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy payments_select_client
  on payments for select
  to authenticated
  using (
    exists (
      select 1 from invoices i
      where i.id = payments.invoice_id
        and fn_has_project_role(i.project_id, array['client_approver', 'client_viewer'])
        and i.status <> 'draft'
    )
  );

select fn_install_standard_triggers('payments');

-- ===========================================================================
-- funding_receipts gets a new nullable column (additive ALTER, same shape
-- as quality-gate adding work_packages.work_type in Fase 5): the link an
-- issued invoice's mirrored funding_receipts row needs so
-- fn_payments_sync_invoice_paid can find and clear the right one.
-- ===========================================================================

alter table funding_receipts add column invoice_id uuid references invoices (id) on delete restrict;
create index idx_funding_receipts_invoice_id on funding_receipts (invoice_id) where deleted_at is null;

-- ===========================================================================
-- fn_invoices_guard_issuance -- the real DB-layer block for "invoice hanya
-- bisa terbit saat syarat terpenuhi" (ARCHITECTURE.md 7's exit criterion).
-- Mirrors modules/billing/domain's own eligibility check, the same
-- relationship canProceed()/fn_work_packages_guard_hold_point have.
-- ===========================================================================

create or replace function fn_invoices_guard_issuance()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_milestone_status milestone_status;
  v_change_order_status change_order_status;
  v_approver_role org_role;
  v_unmet_count integer;
begin
  if new.status is distinct from 'issued' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'issued' then
    return new; -- already issued; not a transition into it
  end if;

  select status into v_milestone_status from milestones where id = new.milestone_id;
  if v_milestone_status is distinct from 'completed' then
    raise exception 'Milestone belum selesai, invoice belum bisa terbit'
      using errcode = 'check_violation', hint = 'ARCHITECTURE.md 7 (Fase 7), ADR 0017.';
  end if;

  select count(*) into v_unmet_count
  from work_packages wp
  join hold_point_templates hpt
    on hpt.organization_id = wp.organization_id
   and hpt.work_type = wp.work_type
   and hpt.is_active
   and hpt.deleted_at is null
  where wp.milestone_id = new.milestone_id
    and wp.deleted_at is null
    and wp.work_type is not null
    and not exists (
      select 1 from inspections i
      where i.work_package_id = wp.id
        and i.hold_point_template_id = hpt.id
        and i.deleted_at is null
        and (i.status = 'passed' or i.overridden_by is not null)
    );
  if v_unmet_count > 0 then
    raise exception 'QC belum lulus: % hold point wajib pada paket kerja milestone ini belum disetujui', v_unmet_count
      using errcode = 'check_violation', hint = 'ARCHITECTURE.md 7 (Fase 7), ADR 0017.';
  end if;

  if new.change_order_id is not null then
    select status into v_change_order_status from change_orders where id = new.change_order_id;
    if v_change_order_status is distinct from 'approved_funded' then
      raise exception 'Variation terkait belum approved_funded, invoice belum bisa terbit'
        using errcode = 'check_violation', hint = 'ARCHITECTURE.md 7 (Fase 7), ADR 0017.';
    end if;
  end if;

  if new.approved_by is null then
    raise exception 'Invoice wajib disetujui Technical Director sebelum terbit'
      using errcode = 'check_violation', hint = 'ARCHITECTURE.md 7 (Fase 7), ADR 0017.';
  end if;

  select org_role into v_approver_role from users where id = new.approved_by and deleted_at is null;
  if v_approver_role is distinct from 'technical_director' then
    raise exception 'Hanya Technical Director yang boleh menyetujui invoice'
      using errcode = 'insufficient_privilege', hint = 'ARCHITECTURE.md 7 (Fase 7), ADR 0017.';
  end if;

  new.issued_at := now();
  return new;
end;
$$;

comment on function fn_invoices_guard_issuance() is
  'ARCHITECTURE.md 7''s DB-layer issuance gate (ADR 0017): milestone completed + QC clean across every work package under it + variation funded (if any) + Technical Director approval. Fires on the transition into status=issued, INSERT or UPDATE.';

create trigger trg_invoices_guard_issuance
  before insert or update of status on invoices
  for each row execute function fn_invoices_guard_issuance();

-- ===========================================================================
-- fn_invoices_sync_funding_receipt / fn_payments_sync_invoice_paid --
-- ADR 0017 SS2's answer to "hubungan otomatis overdue -> Cash Gate": an
-- issued invoice mirrors itself into funding_receipts (already the thing
-- fn_cash_gate_status, Fase 2, reads to decide overdue) instead of teaching
-- Cash Gate a second overdue concept. security definer: the caller issuing
-- an invoice or recording a payment has no direct write access to
-- funding_receipts (a different module's table) or, for payments, to
-- invoices itself.
-- ===========================================================================

create or replace function fn_invoices_sync_funding_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'issued' and (tg_op = 'INSERT' or old.status is distinct from 'issued') then
    insert into funding_receipts (organization_id, project_id, milestone_id, amount, expected_date, invoice_id)
    values (new.organization_id, new.project_id, new.milestone_id, new.amount, new.due_date, new.id);
  end if;
  return new;
end;
$$;

comment on function fn_invoices_sync_funding_receipt() is
  'ADR 0017 SS2: mirrors an issued invoice into cash-gate''s funding_receipts so an overdue, unpaid invoice is simply an overdue, uncleared funding receipt -- fn_cash_gate_status (Fase 2) needs zero changes.';

create trigger trg_invoices_sync_funding_receipt
  after insert or update of status on invoices
  for each row execute function fn_invoices_sync_funding_receipt();

create or replace function fn_payments_sync_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_invoice_amount bigint;
  v_paid_total bigint;
begin
  select amount into v_invoice_amount from invoices where id = new.invoice_id;
  select coalesce(sum(amount), 0) into v_paid_total
  from payments
  where invoice_id = new.invoice_id and deleted_at is null;

  if v_paid_total >= v_invoice_amount then
    update invoices set status = 'paid' where id = new.invoice_id and status = 'issued';
    update funding_receipts set cleared_at = now() where invoice_id = new.invoice_id and cleared_at is null;
  end if;

  return new;
end;
$$;

comment on function fn_payments_sync_invoice_paid() is
  'ADR 0017 SS2: once payments against an invoice reach its full amount, marks the invoice paid and clears the funding_receipts row fn_invoices_sync_funding_receipt created for it.';

create trigger trg_payments_sync_invoice_paid
  after insert on payments
  for each row execute function fn_payments_sync_invoice_paid();
