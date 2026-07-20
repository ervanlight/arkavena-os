-- Fix a bug introduced by the previous migration
-- (20260720000300_wave1_privilege_guard_exempt_service_roles.sql), caught by
-- re-running pnpm test:db immediately after: that migration added a
-- `current_user in ('postgres', 'service_role')` early exit to
-- fn_users_guard_privileged_columns, but the function is declared SECURITY
-- DEFINER. Inside a SECURITY DEFINER function, current_user is the function's
-- OWNER (postgres, since migrations run as postgres), not the caller --
-- confirmed with a throwaway pg_temp function: current_user outside was
-- 'authenticated' (set via `select set_config('role', 'authenticated',
-- true)`, exactly what supabase/tests/db.ts's asUser() does), current_user
-- inside a SECURITY DEFINER function was 'postgres' regardless. The exemption
-- therefore matched every single caller unconditionally, silently disabling
-- the whole guard -- three privilege-escalation tests that were passing
-- before 20260720000300 started failing the moment it landed, which is what
-- caught this before it reached anything real.
--
-- The fix is to drop SECURITY DEFINER from this function rather than to find
-- a different way to read the caller's role from inside one. Nothing in this
-- function's own body needs elevated privilege -- it only compares NEW/OLD
-- columns and calls fn_current_org_role(), which is separately SECURITY
-- DEFINER and keeps working correctly when called from a non-definer caller,
-- since that inner function elevates for its own execution regardless of the
-- outer function's security context. Removing SECURITY DEFINER here is what
-- makes current_user mean what the previous migration assumed it already
-- meant.

create or replace function fn_users_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if new.org_role is distinct from old.org_role
     or new.organization_id is distinct from old.organization_id
     or new.status is distinct from old.status
  then
    if fn_current_org_role() is distinct from 'owner' then
      raise exception
        'Only an owner may change org_role, organization_id or status'
        using errcode = 'insufficient_privilege',
              hint = 'These columns decide what a user can see. See ADR 0005.';
    end if;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception
      'A user cannot be moved between organisations'
      using errcode = 'feature_not_supported';
  end if;

  return new;
end;
$$;

comment on function fn_users_guard_privileged_columns() is
  'Blocks privilege escalation by authenticated end users. Exempts current_user postgres/service_role -- migrations and trusted backend code, not the application-facing anon/authenticated roles this guard actually targets. NOT security definer: that property made current_user reflect the function owner instead of the caller, silently disabling the whole guard (20260720000400).';
