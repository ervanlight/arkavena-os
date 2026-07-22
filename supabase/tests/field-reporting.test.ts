import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, expectRejection, sql } from './db';
import {
  addProjectMember,
  cleanupOrganizations,
  createOrgWithStaff,
  createProjectWithClientAndSite,
  createUser,
  type SeedClient,
  type SeedOrg,
  type SeedProject,
  type SeedSite,
  type SeedUser,
} from './factories';

/**
 * Integration/DB tests for Fase 4's field-reporting tables (FR7,
 * ARCHITECTURE.md 0.2 / CLAUDE.md law 6). Same discipline as
 * fase1-rls.test.ts and scope-variation.test.ts: two organisations, proof
 * the database itself refuses rather than trusting the application layer,
 * and a real audit-trigger row for every mutation.
 *
 * All five tables share one RLS shape (staff org-wide, site_coordinator/
 * mandor per-project, everyone else nothing -- docs/rls-matrix.md's Fase 4
 * section), so daily_logs gets the full treatment and the other four get a
 * lighter spot-check rather than repeating five near-identical describe
 * blocks.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let external: SeedUser; // staff-less, no project membership at all
let project: SeedProjectWithClientAndSite;
let mandor: SeedUser;
let clientViewer: SeedUser; // a project role that is NOT site_coordinator/mandor

let orgB: SeedOrg;
let ownerB: SeedUser;
let projectB: SeedProjectWithClientAndSite;

let workPackageId: string;
let zoneId: string;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  external = a.external;
  project = await createProjectWithClientAndSite(org.id);
  mandor = await createUser({ organizationId: org.id, orgRole: null });
  clientViewer = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(project.id, mandor.id, 'mandor');
  await addProjectMember(project.id, clientViewer.id, 'client_viewer');

  const rows = await sql<{ id: string }>(
    `insert into work_packages (organization_id, project_id, name) values ($1, $2, 'Pekerjaan pondasi') returning id`,
    [org.id, project.id],
  );
  workPackageId = rows[0]!.id;

  const zoneRows = await sql<{ id: string }>(
    `insert into zones (organization_id, project_id, name) values ($1, $2, 'Zona A') returning id`,
    [org.id, project.id],
  );
  zoneId = zoneRows[0]!.id;

  const b = await createOrgWithStaff();
  orgB = b.org;
  ownerB = b.owner;
  projectB = await createProjectWithClientAndSite(orgB.id);

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

describe('daily_logs -- RLS (full treatment; other four tables spot-check the same shape)', () => {
  it('lets staff see a daily log in their own organisation', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by, weather)
       values ($1, $2, current_date, $3, 'Cerah') returning id`,
      [org.id, project.id, owner.id],
    );

    await asUser(owner.id, async (run) => {
      const rows = await run('select id from daily_logs where id = $1', [row!.id]);
      expect(rows).toHaveLength(1);
    });
  });

  it('lets a mandor on the project see and insert a daily log', async () => {
    await asUser(mandor.id, async (run) => {
      const rows = await run(
        `insert into daily_logs (organization_id, project_id, log_date, reported_by, weather)
         values ($1, $2, current_date + 1, $3, 'Mendung') returning id`,
        [org.id, project.id, mandor.id],
      );
      expect(rows).toHaveLength(1);

      const selected = await run('select id from daily_logs where id = $1', [rows[0]!.id]);
      expect(selected).toHaveLength(1);
    });
  });

  it('hides a project-role holder who is not site_coordinator/mandor (client_viewer)', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by, weather)
       values ($1, $2, current_date + 2, $3, 'Hujan') returning id`,
      [org.id, project.id, owner.id],
    );

    await asUser(clientViewer.id, async (run) => {
      const rows = await run('select id from daily_logs where id = $1', [row!.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('refuses an insert from a user with no org_role and no project membership at all', async () => {
    const error = await expectRejection(
      asUser(external.id, (run) =>
        run(
          `insert into daily_logs (organization_id, project_id, log_date, reported_by)
           values ($1, $2, current_date + 3, $3)`,
          [org.id, project.id, external.id],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('hides a daily log across organisations, for staff too', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by)
       values ($1, $2, current_date, $3) returning id`,
      [orgB.id, projectB.id, ownerB.id],
    );

    await asUser(owner.id, async (run) => {
      const rows = await run('select id from daily_logs where id = $1', [row!.id]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('the other four tables -- same RLS shape, one spot-check each', () => {
  it('progress_entries: mandor can insert against a work package on their project', async () => {
    const [dailyLog] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by)
       values ($1, $2, current_date + 10, $3) returning id`,
      [org.id, project.id, mandor.id],
    );

    await asUser(mandor.id, async (run) => {
      const rows = await run(
        `insert into progress_entries (organization_id, project_id, daily_log_id, work_package_id, progress_percent, created_by)
         values ($1, $2, $3, $4, 60, $5) returning id`,
        [org.id, project.id, dailyLog!.id, workPackageId, mandor.id],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it('photos: client_viewer (a project role, but not a field one) cannot insert', async () => {
    const error = await expectRejection(
      asUser(clientViewer.id, (run) =>
        run(
          `insert into photos (organization_id, project_id, zone_id, storage_path, thumbnail_path, file_size_bytes, uploaded_by)
           values ($1, $2, $3, 'a/b/c.jpg', 'a/b/c-thumb.jpg', 1000, $4)`,
          [org.id, project.id, zoneId, clientViewer.id],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('material_requests: staff sees their own org, not the other one', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into material_requests (organization_id, project_id, item_description, quantity, unit, requested_by)
       values ($1, $2, 'Semen', 10, 'sak', $3) returning id`,
      [org.id, project.id, owner.id],
    );

    await asUser(ownerB.id, async (run) => {
      const rows = await run('select id from material_requests where id = $1', [row!.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('issues: mandor can insert against their own project', async () => {
    await asUser(mandor.id, async (run) => {
      const rows = await run(
        `insert into issues (organization_id, project_id, title, reported_by)
         values ($1, $2, 'Retak dinding', $3) returning id`,
        [org.id, project.id, mandor.id],
      );
      expect(rows).toHaveLength(1);
    });
  });
});

describe('column-level constraints RLS cannot express', () => {
  it('rejects a progress_percent outside 0-100', async () => {
    const [dailyLog] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by)
       values ($1, $2, current_date + 20, $3) returning id`,
      [org.id, project.id, owner.id],
    );

    await expect(
      sql(
        `insert into progress_entries (organization_id, project_id, daily_log_id, work_package_id, progress_percent, created_by)
         values ($1, $2, $3, $4, 101, $5)`,
        [org.id, project.id, dailyLog!.id, workPackageId, owner.id],
      ),
    ).rejects.toThrow(/ck_progress_entries_percent_range|violates check constraint/i);
  });

  it('rejects a non-positive material_requests.quantity', async () => {
    await expect(
      sql(
        `insert into material_requests (organization_id, project_id, item_description, quantity, unit, requested_by)
         values ($1, $2, 'Pasir', 0, 'kubik', $3)`,
        [org.id, project.id, owner.id],
      ),
    ).rejects.toThrow(/ck_material_requests_quantity_positive|violates check constraint/i);
  });

  it('rejects a non-positive photos.file_size_bytes', async () => {
    await expect(
      sql(
        `insert into photos (organization_id, project_id, zone_id, storage_path, thumbnail_path, file_size_bytes, uploaded_by)
         values ($1, $2, $3, 'a/b/d.jpg', 'a/b/d-thumb.jpg', 0, $4)`,
        [org.id, project.id, zoneId, owner.id],
      ),
    ).rejects.toThrow(/ck_photos_file_size_positive|violates check constraint/i);
  });

  it('rejects a second daily_logs row for the same project and date', async () => {
    // A fixed date comfortably outside every current_date-relative offset
    // used elsewhere in this file (up to +40) -- found the hard way when an
    // earlier test's current_date + 10 landed on the literal '2026-08-01'
    // this test used to hardcode, a same-project date collision between two
    // unrelated tests rather than a real bug in the constraint itself.
    const logDate = '2027-01-01';
    await sql(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by) values ($1, $2, $3, $4)`,
      [org.id, project.id, logDate, owner.id],
    );

    await expect(
      sql(
        `insert into daily_logs (organization_id, project_id, log_date, reported_by) values ($1, $2, $3, $4)`,
        [org.id, project.id, logDate, mandor.id],
      ),
    ).rejects.toThrow(/uq_daily_logs_project_id_log_date|duplicate key/i);
  });
});

describe('audit trail -- fn_audit_row_change fires for these tables too', () => {
  it('records an insert row for a new daily log', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by, weather)
       values ($1, $2, current_date + 30, $3, 'Cerah') returning id`,
      [org.id, project.id, owner.id],
    );

    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'daily_logs' and entity_id = $1 and action = 'insert' and source = 'trigger'`,
      [row!.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('records a status_change row for a material_request status update', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into material_requests (organization_id, project_id, item_description, quantity, unit, requested_by)
       values ($1, $2, 'Besi beton', 20, 'batang', $3) returning id`,
      [org.id, project.id, owner.id],
    );

    await sql(`update material_requests set status = 'fulfilled' where id = $1`, [row!.id]);

    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'material_requests' and entity_id = $1 and action = 'status_change' and source = 'trigger'`,
      [row!.id],
    );
    expect(rows).toHaveLength(1);
  });
});

describe('offline-replay idempotency -- a client-generated id lets a retried create upsert instead of duplicating (D3)', () => {
  it('re-sending the same daily_logs id with different field values updates the row rather than erroring or duplicating', async () => {
    // Both statements and the final assertion run inside one asUser() call:
    // asUser wraps every call in its own transaction that is always rolled
    // back at the end, so two *separate* calls would each roll back their
    // own insert before the other ever saw it -- this needs the retry to
    // observe the original row, which only holds within a single
    // transaction/connection. Nothing here needs to survive past the test
    // either way, so rolling back at the end is exactly the right cleanup.
    const clientId = '99999999-9999-4999-8999-999999999999';

    await asUser(mandor.id, async (run) => {
      await run(
        `insert into daily_logs (id, organization_id, project_id, log_date, reported_by, weather, manpower_count)
         values ($1, $2, $3, current_date + 50, $4, 'Cerah', 5)`,
        [clientId, org.id, project.id, mandor.id],
      );

      // Simulates the outbox (FR5) replaying the same create after a
      // dropped connection, with the field values as they stood at retry
      // time.
      await run(
        `insert into daily_logs (id, organization_id, project_id, log_date, reported_by, weather, manpower_count)
         values ($1, $2, $3, current_date + 50, $4, 'Hujan', 6)
         on conflict (id) do update set weather = excluded.weather, manpower_count = excluded.manpower_count`,
        [clientId, org.id, project.id, mandor.id],
      );

      const rows = await run('select weather, manpower_count from daily_logs where id = $1', [clientId]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ weather: 'Hujan', manpower_count: 6 });
    });
  });
});
