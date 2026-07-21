-- Closes a gap found while writing Fase 3's integration tests (SV8): the
-- previous migration's trg_change_orders_guard_transition only fired
-- `before update of status`, so a direct INSERT could set
-- change_orders.status to anything at all -- 'approved_funded', even
-- 'completed' -- bypassing the state machine entirely for the one
-- operation the previous migration didn't guard. Same class of gap Fase
-- 2's trg_work_packages_guard_cash_gate already closed for INSERT (Wave 7,
-- 20260721000600: "a work package inserted directly with status =
-- 'in_progress' would otherwise bypass the gate entirely").

create or replace function fn_change_orders_guard_transition()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception
        'A new change order must start as draft, not %', new.status
        using errcode = 'check_violation',
              hint = 'ARCHITECTURE.md 4.3, ADR 0012.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'under_review') or
      (old.status = 'under_review' and new.status = 'awaiting_client_approval') or
      (old.status = 'under_review' and new.status = 'rejected') or
      (old.status = 'awaiting_client_approval' and new.status = 'approved_unpaid') or
      (old.status = 'awaiting_client_approval' and new.status = 'rejected') or
      (old.status = 'approved_unpaid' and new.status = 'approved_funded') or
      (old.status = 'approved_funded' and new.status = 'completed')
    ) then
      raise exception
        'Transisi status change_order dari % ke % tidak diperbolehkan', old.status, new.status
        using errcode = 'check_violation',
              hint = 'ARCHITECTURE.md 4.3, ADR 0012.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger trg_change_orders_guard_transition on change_orders;

create trigger trg_change_orders_guard_transition
  before insert or update of status on change_orders
  for each row execute function fn_change_orders_guard_transition();

comment on function fn_change_orders_guard_transition() is
  'Database-layer mirror of modules/scope-variation/domain/transition.ts''s TRANSITIONS graph (ARCHITECTURE.md 0.2, 4.3). Fires on INSERT too, not just UPDATE OF status, so a direct SQL insert cannot start a change order anywhere but draft.';
