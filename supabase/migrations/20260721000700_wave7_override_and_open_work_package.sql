-- Fills in how ADR 0010's "same transaction" requirement is actually
-- achieved: a single Postgres function call is inherently one transaction,
-- so inserting the override row and updating the work package inside one
-- function call guarantees atomicity without the application needing its
-- own transaction-management code (supabase-js has no simple API for
-- spanning an insert and an update across two calls in one transaction).
--
-- Not SECURITY DEFINER: RLS on both tables (staff of the org) applies
-- naturally to the calling user, and trg_cash_gate_overrides_guard_owner_only
-- still fires as part of this same transaction, so "only an owner may
-- override" keeps holding exactly as it does for a standalone insert.
--
-- Scoped to work_packages only, matching ADR 0009 decision 1 -- Fase 8 adds
-- the equivalent for purchase_orders when that table exists, not a rewritten
-- copy of this function.

create or replace function fn_override_and_open_work_package(
  p_work_package_id uuid,
  p_reason text
)
returns work_packages
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_work_package work_packages;
  v_organization_id uuid;
  v_project_id uuid;
begin
  select organization_id, project_id into v_organization_id, v_project_id
  from work_packages
  where id = p_work_package_id and deleted_at is null;

  if v_project_id is null then
    raise exception 'Work package % not found', p_work_package_id using errcode = 'no_data_found';
  end if;

  insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by)
  values (v_organization_id, v_project_id, 'open_work_package', p_reason, (select auth.uid()));

  update work_packages
  set status = 'in_progress'
  where id = p_work_package_id
  returning * into v_work_package;

  return v_work_package;
end;
$$;

comment on function fn_override_and_open_work_package(uuid, text) is
  'ADR 0010: inserts the override and opens the work package in one transaction. RLS and trg_cash_gate_overrides_guard_owner_only both still apply to the calling user -- this function grants no privilege of its own.';
