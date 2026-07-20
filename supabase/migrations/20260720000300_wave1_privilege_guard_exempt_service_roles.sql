-- Fix: fn_users_guard_privileged_columns blocked privileged-column writes made
-- by infrastructure, not just by end users -- the bug it was actually meant to
-- stop.
--
-- Found by pnpm test:db against the real cloud database (ARCHITECTURE.md 4.5
-- exists precisely to catch this kind of thing before it reaches production):
-- a plain `update users set status = 'active'` through the project's own
-- `postgres` role failed with "Only an owner may change org_role,
-- organization_id or status", because the guard calls fn_current_org_role(),
-- which resolves through auth.uid() -- and a superuser or service-role
-- connection carries no end-user JWT, so auth.uid() is null and the guard
-- treated that as "definitely not an owner" rather than "not an ordinary user
-- session at all".
--
-- The guard's actual job (ARCHITECTURE.md 0.2, the trigger comment in Wave 1)
-- is to stop an authenticated end user from escalating their own access
-- through the application layer even if a server action's permission check is
-- bypassed. It was never meant to block the database owner running migrations,
-- or backend code using the service-role key to activate a newly-provisioned
-- user after their first sign-in -- both of which are legitimate, and neither
-- of which goes through PostgREST as an ordinary authenticated user.
--
-- current_user is the right signal, not auth.uid() is null: Supabase connects
-- migrations and dashboard SQL as the `postgres` role and backend
-- service-role calls as the `service_role` role, distinctly from `anon` and
-- `authenticated`, which is what PostgREST uses for actual application
-- traffic. Checking current_user mirrors how Postgres already treats a table
-- owner as exempt from its own RLS by default -- this trigger is simply doing
-- the same thing explicitly, since triggers (unlike RLS) do not get that
-- exemption for free.

create or replace function fn_users_guard_privileged_columns()
returns trigger
language plpgsql
security definer
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
  'Blocks privilege escalation by authenticated end users. Exempts current_user postgres/service_role -- migrations and trusted backend code, not the application-facing anon/authenticated roles this guard actually targets.';
