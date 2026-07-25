import { randomUUID } from 'node:crypto';
import { sql, withPrivilegedClient } from './db';

/**
 * Test data factories (ARCHITECTURE.md 2.5).
 *
 * Every suite builds its own data through these rather than reading the demo
 * seed. Two reasons, and the second is the one that bites: a test depending on
 * seed row "owner@demo.test" breaks the day someone edits the demo, and it
 * breaks in a way that looks like a policy regression rather than a fixture
 * change.
 *
 * Rows are created with full privileges, since setting up a fixture is not what
 * is under test. What is under test then runs through `asUser`, with RLS on.
 */

export type SeedOrg = { id: string; name: string; slug: string };
export type SeedUser = { id: string; email: string; organizationId: string; orgRole: string | null };

export async function createOrganization(overrides: Partial<SeedOrg> = {}): Promise<SeedOrg> {
  const id = overrides.id ?? randomUUID();
  const suffix = id.slice(0, 8);
  const org: SeedOrg = {
    id,
    name: overrides.name ?? `Org ${suffix}`,
    slug: overrides.slug ?? `org-${suffix}`,
  };

  await sql('insert into organizations (id, name, slug) values ($1, $2, $3)', [
    org.id,
    org.name,
    org.slug,
  ]);

  return org;
}

/**
 * Create an auth user and its profile.
 *
 * The auth.users row has to exist first: public.users.id is a foreign key to
 * it, which is what stops a profile existing for someone who cannot sign in.
 */
export async function createUser(options: {
  organizationId: string;
  orgRole?: string | null;
  status?: 'invited' | 'active' | 'suspended';
  email?: string;
  fullName?: string;
}): Promise<SeedUser> {
  const id = randomUUID();
  const email = options.email ?? `user-${id.slice(0, 8)}@test.local`;

  await sql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                             created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
             '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())`,
    [id, email],
  );

  await sql(
    `insert into users (id, organization_id, email, full_name, org_role, status)
     values ($1, $2, $3, $4, $5::org_role, $6::user_status)`,
    [
      id,
      options.organizationId,
      email,
      options.fullName ?? `User ${id.slice(0, 8)}`,
      options.orgRole ?? null,
      options.status ?? 'active',
    ],
  );

  return { id, email, organizationId: options.organizationId, orgRole: options.orgRole ?? null };
}

/**
 * An organisation with one user per internal role, plus one external user who
 * holds no org_role.
 *
 * The external user matters more than it looks: they are the case that proves
 * "staff only" policies actually exclude someone, rather than passing because
 * every user in the fixture happened to be staff.
 */
export async function createOrgWithStaff(): Promise<{
  org: SeedOrg;
  owner: SeedUser;
  technicalDirector: SeedUser;
  finance: SeedUser;
  qs: SeedUser;
  procurement: SeedUser;
  external: SeedUser;
}> {
  const org = await createOrganization();

  return {
    org,
    owner: await createUser({ organizationId: org.id, orgRole: 'owner' }),
    technicalDirector: await createUser({ organizationId: org.id, orgRole: 'technical_director' }),
    finance: await createUser({ organizationId: org.id, orgRole: 'finance' }),
    qs: await createUser({ organizationId: org.id, orgRole: 'qs' }),
    procurement: await createUser({ organizationId: org.id, orgRole: 'procurement' }),
    external: await createUser({ organizationId: org.id, orgRole: null }),
  };
}

export type SeedClient = { id: string; organizationId: string; name: string };
export type SeedSite = { id: string; organizationId: string; clientId: string; name: string };
export type SeedProject = { id: string; organizationId: string; clientId: string; siteId: string; name: string };

export async function createClient(
  organizationId: string,
  overrides: Partial<{ name: string }> = {},
): Promise<SeedClient> {
  const id = randomUUID();
  const name = overrides.name ?? `Client ${id.slice(0, 8)}`;
  await sql('insert into clients (id, organization_id, name) values ($1, $2, $3)', [id, organizationId, name]);
  return { id, organizationId, name };
}

export async function createSite(
  organizationId: string,
  clientId: string,
  overrides: Partial<{ name: string }> = {},
): Promise<SeedSite> {
  const id = randomUUID();
  const name = overrides.name ?? `Site ${id.slice(0, 8)}`;
  await sql('insert into sites (id, organization_id, client_id, name) values ($1, $2, $3, $4)', [
    id,
    organizationId,
    clientId,
    name,
  ]);
  return { id, organizationId, clientId, name };
}

export async function createProject(
  organizationId: string,
  clientId: string,
  siteId: string,
  overrides: Partial<{ name: string }> = {},
): Promise<SeedProject> {
  const id = randomUUID();
  const name = overrides.name ?? `Project ${id.slice(0, 8)}`;
  await sql('insert into projects (id, organization_id, client_id, site_id, name) values ($1, $2, $3, $4, $5)', [
    id,
    organizationId,
    clientId,
    siteId,
    name,
  ]);
  return { id, organizationId, clientId, siteId, name };
}

/** A project plus its client and site, in one call -- the common case for tests that just need "a project". */
export async function createProjectWithClientAndSite(organizationId: string): Promise<
  SeedProject & { clientRow: SeedClient; siteRow: SeedSite }
> {
  const clientRow = await createClient(organizationId);
  const siteRow = await createSite(organizationId, clientRow.id);
  const project = await createProject(organizationId, clientRow.id, siteRow.id);
  return { ...project, clientRow, siteRow };
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  projectRole: string,
): Promise<{ id: string }> {
  const id = randomUUID();
  await sql('insert into project_members (id, project_id, user_id, project_role) values ($1, $2, $3, $4::project_role)', [
    id,
    projectId,
    userId,
    projectRole,
  ]);
  return { id };
}

/**
 * Remove everything a suite created, leaving the reference seed intact.
 *
 * This is harder than it looks, and the difficulty is a feature of the schema
 * rather than an accident.
 *
 * Every foreign key is ON DELETE RESTRICT, and every audited table fires an
 * AFTER DELETE trigger that writes an audit row referencing the thing just
 * deleted. In combination, a hard delete cannot complete: removing a user is
 * blocked by the audit rows naming them as actor, and removing an organisation
 * fails because its own deletion trigger tries to insert a row pointing at it.
 *
 * In production that is exactly right. Construction records are removed by
 * setting `deleted_at`, never by DELETE, so the trail cannot be erased -- which
 * is the point of an append-only audit table.
 *
 * Tests are the one place that needs the real thing gone. `session_replication_role
 * = replica` suspends user triggers for this connection only, which is why the
 * deletes below are ordered by dependency: profiles before auth users, children
 * before parents.
 */
export async function cleanupOrganizations(orgIds: readonly string[]): Promise<void> {
  if (orgIds.length === 0) return;

  await withPrivilegedClient(async (run) => {
    // One dedicated connection: session_replication_role is session state, and
    // through a pool it could apply to a different connection than the deletes.
    await run('set session_replication_role = replica');
    try {
      await run('delete from notifications where organization_id = any($1::uuid[])', [orgIds]);
      // Audit rows written while acting as one of these users, including
      // entries against global tables such as roles, which carry no
      // organization_id of their own.
      await run(
        `delete from audit_logs
         where organization_id = any($1::uuid[])
            or actor_user_id in (select id from users where organization_id = any($1::uuid[]))`,
        [orgIds],
      );
      // Fase 2 (modules/cash-gate): funding_receipts references milestones,
      // so it must go before them; the other three only reference
      // organizations/projects, already ordered below.
      await run('delete from cash_gate_overrides where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from funding_receipts where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from cash_forecasts where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from project_risk_reserves where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 7 (modules/billing): payments references invoices, invoices
      // references milestones and (nullably) change_orders -- both deleted
      // after this point below, so payments/invoices must go here, after
      // funding_receipts (which invoices.id is itself referenced by, via
      // funding_receipts.invoice_id, already deleted just above).
      await run('delete from payments where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from invoices where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 4 (modules/field-reporting): found missing while writing FR7's
      // own DB tests -- replica mode suspends FK checks, so leaving these
      // out did not fail loudly, it just left orphaned rows behind in the
      // shared dev project on every run. progress_entries/photos before
      // daily_logs/work_packages/zones, the tables they reference.
      await run('delete from progress_entries where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from photos where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from material_requests where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from issues where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from daily_logs where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 5 (modules/quality-gate): same class of gap as Fase 4's --
      // missing here would not fail loudly (replica mode again), just leave
      // inspections/nonconformities/hold_point_templates behind. nonconformities
      // before inspections, both before work_packages (deleted just below).
      await run('delete from nonconformities where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from inspections where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from hold_point_templates where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 6 (modules/client-portal) and change_orders (Fase 3, modules/
      // scope-variation) -- neither was ever cleaned up here, the exact same
      // silent-leak shape as Fase 4/5's own gaps above, just not caught until
      // client-portal.test.ts (CP8) started asserting cleanliness.
      // client_decisions references change_orders, so it goes first.
      await run('delete from client_decisions where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from change_orders where organization_id = any($1::uuid[])', [orgIds]);
      // Wave 5/6 (Fase 8, modules/estimating): same class of gap as Fase
      // 4/5/6's own -- estimates/estimate_items/proposals all reference
      // projects/organizations with ON DELETE RESTRICT, so leaving them out
      // here does not fail loudly (replica mode again), it just blocks the
      // `projects` delete below once a test actually creates one. proposals
      // and estimate_items before estimates, all three before projects.
      await run('delete from proposals where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from estimate_items where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from estimates where organization_id = any($1::uuid[])', [orgIds]);
      // Wave 2-3/7-9 (Fase 8, modules/procurement): same class of gap --
      // deliveries references purchase_orders, purchase_orders (nullably)
      // references vendor_quotes, both reference vendors -- all with
      // ON DELETE RESTRICT, so leaving any of them out blocks `projects` or
      // `vendors` (deleted further below) once a test actually creates one.
      await run('delete from deliveries where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from purchase_orders where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from vendor_quotes where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from vendors where organization_id = any($1::uuid[])', [orgIds]);
      // Wave 9-10 (Fase 9, modules/maintenance-engine): same class of gap --
      // service_tickets references assets/maintenance_plans/warranties;
      // maintenance_plans and assets (nullably) reference warranties;
      // warranties references handover_items; all ON DELETE RESTRICT, all
      // before projects/sites/clients (deleted further below).
      await run('delete from service_tickets where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from maintenance_plans where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from assets where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from warranties where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from handover_items where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 10 (modules/ai-scribe): ai_generations references organizations/
      // projects (nullably)/users, all ON DELETE RESTRICT -- same class of
      // gap as everything above, blocks `projects`/`users` below otherwise.
      await run('delete from ai_generations where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 12 (modules/evidence, modules/client-portal): same class of gap
      // as everything above -- evidence_overrides and evidence both
      // reference work_packages with ON DELETE RESTRICT, so both must go
      // before work_packages is deleted just below; client_status_updates
      // has no such dependency but is grouped here for the same reason
      // (found while verifying F5's Client Timeline shell -- evidence.test.ts
      // had been leaving all three tables' rows behind in the shared dev
      // project on every run since Fase 12 started).
      await run('delete from evidence_overrides where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from evidence where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from client_status_updates where organization_id = any($1::uuid[])', [orgIds]);
      // Fase 1 (modules/crm, modules/projects): children before parents, even
      // though replica mode suspends the FK checks that would otherwise force
      // this order -- keeping it anyway is cheap and reads as documentation.
      await run('delete from work_packages where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from milestones where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from contracts where organization_id = any($1::uuid[])', [orgIds]);
      await run(
        `delete from project_members
         where project_id in (select id from projects where organization_id = any($1::uuid[]))`,
        [orgIds],
      );
      await run('delete from zones where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from projects where organization_id = any($1::uuid[])', [orgIds]);
      await run('delete from sites where organization_id = any($1::uuid[])', [orgIds]);
      await run(
        `delete from client_users
         where client_id in (select id from clients where organization_id = any($1::uuid[]))`,
        [orgIds],
      );
      await run('delete from clients where organization_id = any($1::uuid[])', [orgIds]);
      // Profile first: public.users.id references auth.users with RESTRICT.
      await run('delete from users where organization_id = any($1::uuid[])', [orgIds]);
      await run(
        `delete from auth.users
         where id not in (select id from public.users)
           and email like '%@test.local'`,
      );
      await run('delete from organizations where id = any($1::uuid[])', [orgIds]);
    } finally {
      await run('set session_replication_role = default');
    }
  });
}
