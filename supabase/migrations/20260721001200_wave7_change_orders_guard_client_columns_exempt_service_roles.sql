-- Fix: fn_change_orders_guard_client_columns treated a raw postgres/
-- service-role connection (no JWT, no session at all) the same as an
-- external client_approver -- fn_current_org_role() resolves to null for
-- both, since it depends on auth.uid(), which a trusted backend connection
-- never sets. Found while running a setup script for SV10's browser
-- verification: a plain admin/migration-style UPDATE setting
-- cost_impact_amount was rejected with "A client approver may only record
-- their own approve/reject decision", which was never the intent.
--
-- Same bug, same fix, as 20260720000300_wave1_privilege_guard_exempt_
-- service_roles.sql applied to fn_users_guard_privileged_columns: check
-- current_user, not fn_current_org_role(), for the "is this trusted backend
-- code" question -- migrations and dashboard SQL connect as `postgres`,
-- backend service-role calls as `service_role`, distinctly from the
-- `anon`/`authenticated` roles PostgREST uses for real application traffic.

create or replace function fn_change_orders_guard_client_columns()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if fn_current_org_role() is not null then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.cost_impact_amount is distinct from old.cost_impact_amount
     or new.schedule_impact_days is distinct from old.schedule_impact_days
     or new.zone_id is distinct from old.zone_id
     or new.project_id is distinct from old.project_id
     or new.organization_id is distinct from old.organization_id
     or new.requested_by is distinct from old.requested_by
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.funded_by is distinct from old.funded_by
     or new.funded_at is distinct from old.funded_at
     or new.completed_by is distinct from old.completed_by
     or new.completed_at is distinct from old.completed_at
  then
    raise exception
      'A client approver may only record their own approve/reject decision, not other fields'
      using errcode = 'insufficient_privilege',
            hint = 'ADR 0012.';
  end if;

  return new;
end;
$$;

comment on function fn_change_orders_guard_client_columns() is
  'Restricts a client_approver''s UPDATE to their own decision columns only (ADR 0012). Exempts current_user postgres/service_role -- migrations and trusted backend code, not the application-facing anon/authenticated roles this guard actually targets.';
