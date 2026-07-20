-- Wave 4: projects, project_members (ARCHITECTURE.md 2.1, Fase 1).
--
-- assessments is also nominally Wave 4, but the assessment module is Fase 8
-- scope (CLAUDE.md law 7) -- this migration is projects and project_members
-- only.
--
-- This is also where fn_has_project_role stops being the Wave 0 placeholder.
-- It could not be written for real before project_members existed; it can
-- now, in the same migration that creates the table it reads.

create type project_status as enum ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled');

-- ===========================================================================
-- projects
--
-- Owned by modules/projects (ARCHITECTURE.md 1.1: this module owns projects,
-- zones, work_packages, project_members, contracts, milestones -- all of Wave
-- 4-6 in Fase 1's scope belongs to one module, not split across several).
-- ===========================================================================

create table projects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  client_id        uuid not null references clients (id) on delete restrict,
  -- Not null from the first migration, not added later -- ADR 0007.
  site_id          uuid not null references sites (id) on delete restrict,
  name             text not null,
  status           project_status not null default 'planning',
  start_date       date,
  target_end_date  date,
  actual_end_date  date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint ck_projects_name_not_blank check (btrim(name) <> '')
);

create index idx_projects_organization_id on projects (organization_id) where deleted_at is null;
create index idx_projects_client_id on projects (client_id) where deleted_at is null;
create index idx_projects_site_id on projects (site_id) where deleted_at is null;

comment on table projects is
  'Owned by modules/projects. The unit everything else in this module (zones, contracts, milestones, work_packages) hangs off.';

alter table projects enable row level security;

-- Internal staff: full CRUD within their organisation.
create policy projects_select_staff
  on projects for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy projects_insert_staff
  on projects for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy projects_update_staff
  on projects for update
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null)
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

-- Anyone holding a project role -- site coordinator, mandor, client approver,
-- client viewer, supplier, subcontractor -- may see the project they are a
-- member of, even though none of them are staff (org_role is null for all of
-- them). This is the first policy in the schema that reads on
-- fn_has_project_role rather than fn_current_org_role.
create policy projects_select_member
  on projects for select
  to authenticated
  using (
    fn_has_project_role(
      id,
      array['site_coordinator', 'mandor', 'client_approver', 'client_viewer', 'supplier', 'subcontractor']
    )
  );

-- No DELETE policy: on delete restrict on every table referencing projects.id
-- makes a hard delete fail loudly the moment any zone, contract, milestone or
-- work package still exists, rather than cascading through project history.

-- ===========================================================================
-- project_members
--
-- The other axis of ARCHITECTURE.md 6.1's two-axis role model: org_role on
-- users is for internal staff, project_role here is for everyone's part in a
-- specific project, internal or external. A member of staff can also hold a
-- project role on a specific project (e.g. a QS acting as client_approver's
-- internal counterpart) -- the two axes are independent, not exclusive.
-- ===========================================================================

create table project_members (
  id          uuid primary key default gen_random_uuid(),
  -- CASCADE, not RESTRICT: a membership row has no meaning without the
  -- project it is membership *in*, unlike projects' other children (zones,
  -- contracts, ...), which are substantial enough that a hard delete should
  -- have to reckon with them explicitly.
  project_id  uuid not null references projects (id) on delete cascade,
  user_id     uuid not null references users (id) on delete restrict,
  project_role project_role not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_project_members_project_id_user_id unique (project_id, user_id)
);

create index idx_project_members_project_id on project_members (project_id);
create index idx_project_members_user_id on project_members (user_id);

comment on table project_members is
  'Owned by modules/projects. Per-project roles (ARCHITECTURE.md 6.1) -- the axis independent of users.org_role. One row per (project, user): a user holds exactly one project_role per project.';

alter table project_members enable row level security;

create policy project_members_select_staff
  on project_members for select
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from projects p
      where p.id = project_members.project_id and p.organization_id = fn_current_org_id()
    )
  );

-- A project member sees their own membership row even if they hold no staff
-- role at all -- otherwise a mandor could never confirm their own access.
create policy project_members_select_self
  on project_members for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy project_members_insert_staff
  on project_members for insert
  to authenticated
  with check (
    fn_current_org_role() is not null
    and exists (
      select 1 from projects p
      where p.id = project_members.project_id and p.organization_id = fn_current_org_id()
    )
  );

create policy project_members_update_staff
  on project_members for update
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from projects p
      where p.id = project_members.project_id and p.organization_id = fn_current_org_id()
    )
  )
  with check (
    fn_current_org_role() is not null
    and exists (
      select 1 from projects p
      where p.id = project_members.project_id and p.organization_id = fn_current_org_id()
    )
  );

create policy project_members_delete_staff
  on project_members for delete
  to authenticated
  using (
    fn_current_org_role() is not null
    and exists (
      select 1 from projects p
      where p.id = project_members.project_id and p.organization_id = fn_current_org_id()
    )
  );

select fn_install_standard_triggers('projects');
select fn_install_standard_triggers('project_members');

-- ===========================================================================
-- fn_has_project_role, for real.
--
-- Replaces the Wave 0 placeholder ("select false" -- fails closed by design
-- until this moment). plpgsql, not the sql the eventual body might suggest:
-- Wave 0's 20260720000100 migration hit a real bug from exactly this choice
-- -- a LANGUAGE SQL function body is validated against the catalog at CREATE
-- time, which breaks the moment a function is defined before (or, out of an
-- abundance of caution, even textually near) the table it reads. project_members
-- already exists by this point in this same file, so it would not fail today,
-- but there is no reason to pay that risk for zero benefit.
-- ===========================================================================

create or replace function fn_has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  return exists (
    select 1
    from project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
      and pm.project_role::text = any(p_roles)
  );
end;
$$;

comment on function fn_has_project_role(uuid, text[]) is
  'Real implementation as of Wave 4 -- replaces the Wave 0 placeholder that always returned false. Checks the signed-in user''s project_role against the given list for one project.';
