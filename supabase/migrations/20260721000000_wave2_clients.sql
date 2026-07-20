-- Wave 2: clients and client_users (ARCHITECTURE.md 2.1, Fase 1 scope per
-- ARCHITECTURE.md 7 and ADR 0007).
--
-- vendors and cost_library are also nominally "Wave 2" per ARCHITECTURE.md 2.1,
-- but they belong to the procurement and estimating modules, which are not in
-- scope until Fase 8 (CLAUDE.md law 7: do not build ahead of the phase). This
-- migration is deliberately narrower than the full Wave 2 table list.

-- ===========================================================================
-- clients
--
-- Owned by the crm module. A client is the organisation (or person) BuildTrust
-- OS's tenant is doing work for -- distinct from `organizations`, which is the
-- tenant itself.
-- ===========================================================================

create table clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name            text not null,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint ck_clients_name_not_blank check (btrim(name) <> ''),
  constraint ck_clients_email_format check (
    email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

create index idx_clients_organization_id on clients (organization_id) where deleted_at is null;

comment on table clients is
  'Owned by modules/crm. The client BuildTrust OS''s tenant is contracted by -- not the tenant itself (that is organizations).';

alter table clients enable row level security;

create policy clients_select_staff
  on clients for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy clients_insert_staff
  on clients for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy clients_update_staff
  on clients for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- No DELETE policy. A client with any project history should never be
-- hard-deleted (deleted_at exists for that); on delete restrict on every table
-- referencing clients.id makes an accidental hard delete fail loudly rather
-- than orphan projects.

-- ===========================================================================
-- client_users
--
-- Links a user to a client company, so an external contact can be modelled as
-- something other than an internal member of staff. Nothing reads this table
-- yet -- the client portal is Fase 6 -- but projects and project_members
-- (Wave 4) need clients to already distinguish "our staff" from "their
-- people", and that distinction starts here.
-- ===========================================================================

create table client_users (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients (id) on delete cascade,
  user_id         uuid not null references users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint uq_client_users_client_id_user_id unique (client_id, user_id)
);

-- CASCADE on client_id, not user_id: this row's only meaning is "this user
-- belongs to this client". If the client is hard-deleted, the link should go
-- with it; the referenced user should never disappear silently, matching how
-- every other FK to users.id in this schema is RESTRICT.

create index idx_client_users_client_id on client_users (client_id);
create index idx_client_users_user_id on client_users (user_id);

comment on table client_users is
  'Owned by modules/crm. Join between users and clients -- an external contact''s membership in a client company. Read by the client portal from Fase 6 onward.';

alter table client_users enable row level security;

-- Scoped through clients.organization_id, since client_users itself carries no
-- organization_id column -- one join, not a denormalised copy that could drift.
create policy client_users_select_staff
  on client_users for select
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from clients c
      where c.id = client_users.client_id and c.organization_id = fn_current_org_id()
    )
  );

-- A client contact may see their own membership rows once they can sign in at
-- all -- harmless ahead of the client portal, and saves a Fase 6 policy
-- migration for a rule that does not change.
create policy client_users_select_self
  on client_users for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy client_users_insert_staff
  on client_users for insert
  to authenticated
  with check (
    fn_current_org_role() is not null
    and exists (
      select 1 from clients c
      where c.id = client_users.client_id and c.organization_id = fn_current_org_id()
    )
  );

create policy client_users_delete_staff
  on client_users for delete
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from clients c
      where c.id = client_users.client_id and c.organization_id = fn_current_org_id()
    )
  );

-- No UPDATE policy: the only two columns are the FKs themselves, and changing
-- either is really "delete this link, create a different one" -- there is
-- nothing here that is meaningfully an edit.

select fn_install_standard_triggers('clients');
select fn_install_standard_triggers('client_users');
