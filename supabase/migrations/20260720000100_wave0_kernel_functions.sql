-- Wave 0, part 2: the kernel functions every later wave builds on.
--
-- Four of these are referenced by name in ARCHITECTURE.md 2.1. They are created
-- before any table exists, which Postgres allows: a plpgsql body is resolved
-- when it first runs, not when it is defined. That ordering is deliberate --
-- Wave 1 tables attach these triggers as they are created, so the functions
-- have to exist first.

-- ---------------------------------------------------------------------------
-- fn_set_updated_at
-- ---------------------------------------------------------------------------

create or replace function fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function fn_set_updated_at() is
  'Maintains updated_at. Attached to every table with that column by fn_install_standard_triggers.';

-- ---------------------------------------------------------------------------
-- fn_current_org_id -- the anchor of every org-scoped RLS policy
--
-- ARCHITECTURE.md 6.1 proposes carrying organization_id in JWT custom claims so
-- policies avoid a join. That optimisation needs a custom access token hook and
-- provisioning that keeps app_metadata in step with the users table -- two more
-- moving parts that can drift out of sync, each capable of silently widening
-- what a user can see.
--
-- So this reads the users table instead. It is marked STABLE, so Postgres
-- evaluates it once per statement rather than once per row, which is the cost
-- that actually mattered. Because every policy calls this function rather than
-- inlining the lookup, switching to JWT claims later is a change to one
-- function body, not to forty policies. See ADR 0005.
--
-- SECURITY DEFINER is required, not incidental: the policy on users itself
-- calls this function, and a non-definer version would recurse.
-- ---------------------------------------------------------------------------

create or replace function fn_current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select u.organization_id
  from public.users u
  where u.id = (select auth.uid())
    and u.deleted_at is null;
$$;

comment on function fn_current_org_id() is
  'The organisation of the signed-in user. Returns NULL when unauthenticated, which makes every org-scoped policy fail closed.';

-- ---------------------------------------------------------------------------
-- fn_current_org_role
-- ---------------------------------------------------------------------------

create or replace function fn_current_org_role()
returns org_role
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select u.org_role
  from public.users u
  where u.id = (select auth.uid())
    and u.deleted_at is null
    and u.status = 'active';
$$;

comment on function fn_current_org_role() is
  'Organisation role of the signed-in user, or NULL if absent, suspended or external. Suspended users resolve to NULL so every role check fails closed.';

-- ---------------------------------------------------------------------------
-- fn_has_project_role -- placeholder until Wave 4
--
-- The signature is fixed now so Wave 1-3 policies can reference it and not need
-- rewriting later. The body cannot be written yet: project_members arrives in
-- Wave 4, and a Wave 0 function may not reference a Wave 4 table.
--
-- It returns false, not true. A placeholder that grants access would hand out
-- permissions the moment someone used it; one that denies access fails loudly
-- and visibly instead. Wave 4 replaces this body with CREATE OR REPLACE.
-- ---------------------------------------------------------------------------

create or replace function fn_has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language sql
stable
as $$
  select false;
$$;

comment on function fn_has_project_role(uuid, text[]) is
  'PLACEHOLDER until Wave 4 (project_members). Always false -- fails closed by design. Do not write a policy that depends on this returning true before Wave 4.';

-- ---------------------------------------------------------------------------
-- fn_audit_row_change -- audit channel 1, the safety net (ARCHITECTURE.md 5.2)
--
-- This catches every mutation, including a manual SQL hotfix run at 2am by
-- someone bypassing the application entirely. That is the whole point: the
-- application channel records intent, this one records that something happened
-- at all, and it cannot be forgotten because it is attached to the table.
--
-- It stores a diff -- only the columns that actually changed -- rather than the
-- whole row. Whole rows would multiply the database size by the number of edits
-- and bury the one changed field in fifty unchanged ones, and D9 puts us on a
-- 500MB free tier where that is not an abstract concern.
-- ---------------------------------------------------------------------------

create or replace function fn_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old        jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new        jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_prev       jsonb := '{}'::jsonb;
  v_next       jsonb := '{}'::jsonb;
  v_key        text;
  v_row        jsonb;
  v_action     audit_action;
  v_entity_id  uuid;
  v_org_id     uuid;
  v_project_id uuid;
begin
  -- The surviving version of the row: NEW normally, OLD on delete.
  v_row := case when tg_op = 'DELETE' then v_old else v_new end;

  -- Build the diff. updated_at is skipped because its trigger changes it on
  -- every write, so including it would make every update look like a change
  -- even when nothing meaningful moved.
  for v_key in
    select k from (
      select jsonb_object_keys(v_old) as k
      union
      select jsonb_object_keys(v_new) as k
    ) keys
    where k <> 'updated_at'
  loop
    if (v_old -> v_key) is distinct from (v_new -> v_key) then
      v_prev := v_prev || jsonb_build_object(v_key, v_old -> v_key);
      v_next := v_next || jsonb_build_object(v_key, v_new -> v_key);
    end if;
  end loop;

  -- An update that changed nothing but updated_at is not worth a row.
  if tg_op = 'UPDATE' and v_prev = '{}'::jsonb then
    return null;
  end if;

  v_action := case
    when tg_op = 'INSERT' then 'insert'::audit_action
    when tg_op = 'DELETE' then 'delete'::audit_action
    when v_prev ? 'status' then 'status_change'::audit_action
    else 'update'::audit_action
  end;

  v_entity_id  := nullif(v_row ->> 'id', '')::uuid;
  -- Reference tables such as roles are global and have no organisation.
  v_org_id     := nullif(v_row ->> 'organization_id', '')::uuid;
  v_project_id := nullif(v_row ->> 'project_id', '')::uuid;

  insert into public.audit_logs (
    actor_user_id, organization_id, project_id,
    entity_table, entity_id, action,
    previous_value, new_value, source
  )
  values (
    (select auth.uid()), v_org_id, v_project_id,
    tg_table_name, v_entity_id, v_action,
    v_prev, v_next, 'trigger'
  );

  return null; -- AFTER trigger; the return value is ignored
end;
$$;

comment on function fn_audit_row_change() is
  'Audit channel 1: generic AFTER trigger capturing the OLD/NEW diff. Never call directly -- attach it via fn_install_standard_triggers.';

-- ---------------------------------------------------------------------------
-- fn_record_audit -- audit channel 2, business intent (ARCHITECTURE.md 5.2)
--
-- The trigger above knows a row changed. It cannot know that the change was an
-- owner overriding a red Cash Gate, who asked for it, or why. This is how
-- core/audit records that, and it is the only write path into audit_logs from
-- the application: audit_logs has no INSERT policy, so a module cannot write to
-- it directly even if someone tries.
--
-- The reason requirement is enforced here as well as in TypeScript. The
-- TypeScript version fails at compile time and is the better developer
-- experience; this one holds even for a psql session, which is the point of
-- enforcing money and approval rules in two layers (ARCHITECTURE.md 0.2).
-- ---------------------------------------------------------------------------

create or replace function fn_record_audit(
  p_entity_table  text,
  p_entity_id     uuid,
  p_action        audit_action,
  p_previous      jsonb default '{}'::jsonb,
  p_new           jsonb default '{}'::jsonb,
  p_reason        text  default null,
  p_request_id    text  default null,
  p_project_id    uuid  default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if p_action in ('override', 'approve', 'reject')
     and (p_reason is null or btrim(p_reason) = '') then
    raise exception
      'Audit action % requires a non-empty reason', p_action
      using errcode = 'check_violation',
            hint = 'Overrides and approvals must record why. See ARCHITECTURE.md 5.2.';
  end if;

  insert into public.audit_logs (
    actor_user_id, organization_id, project_id,
    entity_table, entity_id, action,
    previous_value, new_value, reason, request_id, source
  )
  values (
    (select auth.uid()), fn_current_org_id(), p_project_id,
    p_entity_table, p_entity_id, p_action,
    coalesce(p_previous, '{}'::jsonb), coalesce(p_new, '{}'::jsonb),
    p_reason, p_request_id, 'app'
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function fn_record_audit is
  'Audit channel 2: the only application write path into audit_logs. Called by core/audit. Rejects override/approve/reject without a reason.';

-- ---------------------------------------------------------------------------
-- fn_install_standard_triggers
--
-- ARCHITECTURE.md 5.2 asks for the audited-table list to be migration
-- configuration rather than copy-pasted trigger definitions. This is that:
-- every table declares itself audited with one call, so no table can end up
-- audited slightly differently from its neighbours, and the CI check in
-- supabase/tests can simply assert every table has called it.
-- ---------------------------------------------------------------------------

create or replace function fn_install_standard_triggers(p_table text)
returns void
language plpgsql
as $$
begin
  if to_regclass('public.' || quote_ident(p_table)) is null then
    raise exception 'Cannot install triggers: table public.% does not exist', p_table;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'updated_at'
  ) then
    execute format(
      'create trigger trg_%1$s_set_updated_at
         before update on public.%1$I
         for each row execute function fn_set_updated_at()',
      p_table
    );
  end if;

  execute format(
    'create trigger trg_%1$s_audit
       after insert or update or delete on public.%1$I
       for each row execute function fn_audit_row_change()',
    p_table
  );
end;
$$;

comment on function fn_install_standard_triggers(text) is
  'Attaches the updated_at and audit triggers to a table. Every audited table must call this in the migration that creates it.';
