-- Wave 1: identity and kernel -- organizations, roles, users, audit_logs,
-- notifications (ARCHITECTURE.md 2.1).
--
-- Ordering inside this file is forced by a circularity: every audited table
-- needs the audit trigger, and the audit trigger writes into audit_logs, which
-- itself needs organizations and users to exist first. So the tables are all
-- created, then audit_logs, then the triggers are attached at the end.
--
-- Every table here: columns, PK, FK, indexes, updated_at trigger, audit
-- trigger, RLS enabled, policies. A table missing any of those is a CI failure
-- (supabase/tests/schema-guardrails.test.ts), not a code-review nitpick.

-- ===========================================================================
-- organizations
--
-- The tenant boundary (owner decision D1). This is the one table without an
-- organization_id column, because its own id *is* the organisation id. It is
-- named in the CI guardrail's allowlist for that reason. See ADR 0005.
-- ===========================================================================

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  status      organization_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint ck_organizations_name_not_blank check (btrim(name) <> ''),
  -- The pattern also pins the slug to lower case, so no separate check is needed.
  constraint ck_organizations_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

create unique index uq_organizations_slug_active
  on organizations (slug)
  where deleted_at is null;

comment on table organizations is
  'Tenant root. Owner decision D1: one company today, multi-tenant structure from day one.';

alter table organizations enable row level security;

-- Members see their own organisation and no other. There is deliberately no
-- INSERT or DELETE policy: creating and removing tenants is an operator action
-- performed with the service role, not something the application offers.
create policy organizations_select_member
  on organizations for select
  to authenticated
  using (id = fn_current_org_id());

create policy organizations_update_owner
  on organizations for update
  to authenticated
  using (id = fn_current_org_id() and fn_current_org_role() = 'owner')
  with check (id = fn_current_org_id() and fn_current_org_role() = 'owner');

-- ===========================================================================
-- roles
--
-- The eleven fixed roles from ARCHITECTURE.md 6.1, as reference data. Global,
-- not per-organisation: the roles are identical for every tenant and change
-- only by migration, so per-tenant copies would be eleven identical rows that
-- must never diverge. This exemption from D1 is argued in ADR 0005 and named
-- explicitly in the CI guardrail.
--
-- name_id / description_id are Indonesian display strings (owner decision D10:
-- Indonesian UI, English code, no i18n framework). The `_id` suffix here is the
-- language tag, not a foreign key -- the only place in this schema where that
-- suffix does not mean an id.
-- ===========================================================================

create table roles (
  id             uuid primary key default gen_random_uuid(),
  key            text not null,
  scope          role_scope not null,
  name_id        text not null,
  description_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint uq_roles_key unique (key),
  constraint ck_roles_key_format check (key ~ '^[a-z][a-z_]*$')
);

comment on table roles is
  'Reference data: the 11 roles. Global by design (ADR 0005). The set of keys is asserted against the org_role and project_role enums by a db test, in both directions.';

alter table roles enable row level security;

-- Readable by any signed-in user; writable by nobody. Roles change through
-- migrations, so there is no INSERT/UPDATE/DELETE policy at all.
create policy roles_select_authenticated
  on roles for select
  to authenticated
  using (true);

-- ===========================================================================
-- users
--
-- The profile table. Authentication itself lives in auth.users, owned by
-- Supabase; this row carries the organisation, the role, and the display name.
--
-- There is no password column and no phone-verification column: owner decision
-- D4 makes email magic link the only sign-in method for every role.
-- ===========================================================================

create table users (
  id              uuid primary key references auth.users (id) on delete restrict,
  organization_id uuid not null references organizations (id) on delete restrict,
  email           text not null,
  full_name       text not null,
  -- NULL for external people (client, supplier, subcontractor). They hold
  -- project roles instead, in project_members, from Wave 4.
  org_role        org_role,
  status          user_status not null default 'invited',
  -- Contact only. Never used for authentication -- see D4.
  phone           text,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_users_email_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint ck_users_full_name_not_blank check (btrim(full_name) <> '')
);

create unique index uq_users_email on users (lower(email)) where deleted_at is null;
create index idx_users_organization_id on users (organization_id);
create index idx_users_organization_id_org_role on users (organization_id, org_role)
  where deleted_at is null;

comment on table users is
  'Profile for an auth.users row. organization_id here is the source of truth for fn_current_org_id().';
comment on column users.org_role is
  'Internal staff role. NULL for external users, who hold project roles instead.';

alter table users enable row level security;

create policy users_select_org
  on users for select
  to authenticated
  using (organization_id = fn_current_org_id());

-- A user may edit their own profile. Which *columns* they may edit is enforced
-- by trg_users_guard_privileged_columns below, because RLS works on rows and
-- cannot express "everything except org_role".
create policy users_update_self
  on users for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and organization_id = fn_current_org_id());

create policy users_update_owner
  on users for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() = 'owner')
  with check (organization_id = fn_current_org_id() and fn_current_org_role() = 'owner');

-- Provisioning happens with the service role. No INSERT policy on purpose: a
-- signed-in user must not be able to mint another user, and self-signup is not
-- how anyone joins an organisation here.

-- ---------------------------------------------------------------------------
-- Privilege escalation guard.
--
-- Without this, users_update_self would let anyone set their own org_role to
-- 'owner'. RLS cannot express column-level rules, so the restriction is a
-- trigger. This is the database half of the two-layer enforcement in
-- ARCHITECTURE.md 0.2 -- the application will check permissions too, but this
-- holds even if the application is bypassed entirely.
-- ---------------------------------------------------------------------------

create or replace function fn_users_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
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

  -- Moving a user between organisations is not an edit; it is a re-provisioning
  -- decision with consequences for every row they touched. Blocked outright.
  if new.organization_id is distinct from old.organization_id then
    raise exception
      'A user cannot be moved between organisations'
      using errcode = 'feature_not_supported';
  end if;

  return new;
end;
$$;

create trigger trg_users_guard_privileged_columns
  before update on users
  for each row execute function fn_users_guard_privileged_columns();

-- ===========================================================================
-- audit_logs
--
-- Created early in Wave 1 on purpose (ARCHITECTURE.md 2.1): every table from
-- here on is audited, so the destination has to exist before the triggers do.
--
-- Append-only, and not by convention. There is no INSERT, UPDATE or DELETE
-- policy for anyone, and UPDATE/DELETE are revoked at the grant level as well.
-- Both audit channels write through SECURITY DEFINER functions
-- (fn_audit_row_change, fn_record_audit), which is why no INSERT policy is
-- needed -- and means a module cannot write here directly even if it tries.
-- ===========================================================================

create table audit_logs (
  id              uuid primary key default gen_random_uuid(),
  occurred_at     timestamptz not null default now(),
  actor_user_id   uuid references users (id) on delete restrict,
  organization_id uuid references organizations (id) on delete restrict,
  -- No FK yet: projects arrives in Wave 4, and a Wave 1 table may not reference
  -- it. Wave 4 adds the constraint in its own migration.
  project_id      uuid,
  entity_table    text not null,
  entity_id       uuid,
  action          audit_action not null,
  previous_value  jsonb not null default '{}'::jsonb,
  new_value       jsonb not null default '{}'::jsonb,
  reason          text,
  request_id      text,
  source          audit_source not null,

  constraint ck_audit_logs_reason_required check (
    action not in ('override', 'approve', 'reject')
    or (reason is not null and btrim(reason) <> '')
  )
);

create index idx_audit_logs_entity_table_entity_id on audit_logs (entity_table, entity_id, occurred_at desc);
create index idx_audit_logs_organization_id_occurred_at on audit_logs (organization_id, occurred_at desc);
create index idx_audit_logs_actor_user_id on audit_logs (actor_user_id, occurred_at desc);
create index idx_audit_logs_project_id on audit_logs (project_id, occurred_at desc) where project_id is not null;

comment on table audit_logs is
  'Append-only. Two channels: fn_audit_row_change (trigger, catches everything) and fn_record_audit (application, adds reason and request_id). No UPDATE or DELETE path exists for any role.';
comment on column audit_logs.previous_value is
  'Diff, not the whole row -- only columns that actually changed. updated_at is excluded.';
comment on column audit_logs.reason is
  'Mandatory for override, approve and reject. Enforced by check constraint here, by fn_record_audit, and by the type signature of withAudit() in core/audit.';

alter table audit_logs enable row level security;

-- Internal staff read their organisation's trail. External users (client,
-- supplier, subcontractor) hold no org_role, so fn_current_org_role() returns
-- NULL for them and this policy excludes them -- the audit trail is internal.
create policy audit_logs_select_staff
  on audit_logs for select
  to authenticated
  using (
    organization_id = fn_current_org_id()
    and fn_current_org_role() is not null
  );

revoke update, delete on audit_logs from authenticated, anon;

-- Note: audit_logs deliberately has no audit trigger of its own. It would
-- recurse, and an append-only table has nothing to audit.

-- ===========================================================================
-- notifications
-- ===========================================================================

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  user_id         uuid not null references users (id) on delete restrict,
  channel         notification_channel not null,
  status          notification_status not null default 'pending',
  title           text not null,
  body            text,
  -- Deep link target, kept loose because notifications point at rows in tables
  -- that do not exist until later waves.
  entity_table    text,
  entity_id       uuid,
  sent_at         timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint ck_notifications_title_not_blank check (btrim(title) <> '')
);

create index idx_notifications_user_id_created_at on notifications (user_id, created_at desc);
create index idx_notifications_organization_id on notifications (organization_id);
create index idx_notifications_user_id_unread on notifications (user_id) where read_at is null;

comment on table notifications is
  'In-app and email only (owner decision D4/D9: no paid WhatsApp channel at this stage).';

alter table notifications enable row level security;

create policy notifications_select_own
  on notifications for select
  to authenticated
  using (user_id = (select auth.uid()) and organization_id = fn_current_org_id());

-- Marking as read is the only edit a recipient makes. The trigger below keeps
-- it to that.
create policy notifications_update_own
  on notifications for update
  to authenticated
  using (user_id = (select auth.uid()) and organization_id = fn_current_org_id())
  with check (user_id = (select auth.uid()) and organization_id = fn_current_org_id());

create or replace function fn_notifications_guard_recipient_edits()
returns trigger
language plpgsql
as $$
begin
  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.channel is distinct from old.channel
     or new.entity_table is distinct from old.entity_table
     or new.entity_id is distinct from old.entity_id
     or new.user_id is distinct from old.user_id
     or new.organization_id is distinct from old.organization_id
  then
    raise exception
      'A recipient may only mark a notification read, not rewrite it'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger trg_notifications_guard_recipient_edits
  before update on notifications
  for each row execute function fn_notifications_guard_recipient_edits();

-- ===========================================================================
-- Attach the standard triggers.
--
-- This is the audited-table list ARCHITECTURE.md 5.2 asks to keep as migration
-- configuration. audit_logs is absent for the reason noted above.
-- ===========================================================================

select fn_install_standard_triggers('organizations');
select fn_install_standard_triggers('roles');
select fn_install_standard_triggers('users');
select fn_install_standard_triggers('notifications');
