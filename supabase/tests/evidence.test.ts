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
 * Integration/DB tests for Fase 12's Evidence domain (ADR 0026 §3, ADR
 * 0029). Same discipline as cash-gate.test.ts/quality-gate.test.ts: write
 * SQL directly, proving the database itself enforces this, independent of
 * any application code that could be bypassed.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let technicalDirector: SeedUser;
let mandor: SeedUser;
let clientApprover: SeedUser;
let project: SeedProjectWithClientAndSite;

let orgB: SeedOrg;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  technicalDirector = a.technicalDirector;
  project = await createProjectWithClientAndSite(org.id);
  mandor = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(project.id, mandor.id, 'mandor');
  clientApprover = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(project.id, clientApprover.id, 'client_approver');

  const b = await createOrgWithStaff();
  orgB = b.org;

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function insertWorkPackage(): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into work_packages (organization_id, project_id, name) values ($1, $2, 'Pasang keramik') returning id`,
    [org.id, project.id],
  );
  return rows[0]!.id;
}

async function insertZone(): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into zones (organization_id, project_id, name) values ($1, $2, 'Kamar mandi lt2') returning id`,
    [org.id, project.id],
  );
  return rows[0]!.id;
}

async function insertPhoto(overrides: { workPackageId?: string; dailyLogId?: string; handoverItemId?: string }): Promise<string> {
  const zoneId = await insertZone();
  const rows = await sql<{ id: string }>(
    `insert into photos (organization_id, project_id, zone_id, work_package_id, daily_log_id, handover_item_id,
       storage_path, thumbnail_path, file_size_bytes, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, 'test/x.jpg', 'test/x_thumb.jpg', 1000, $7)
     returning id`,
    [
      org.id,
      project.id,
      zoneId,
      overrides.workPackageId ?? null,
      overrides.dailyLogId ?? null,
      overrides.handoverItemId ?? null,
      owner.id,
    ],
  );
  return rows[0]!.id;
}

async function insertActiveContract(): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into contracts (organization_id, project_id, title, contract_amount, status)
     values ($1, $2, 'Kontrak test', 100000000, 'active') returning id`,
    [org.id, project.id],
  );
  return rows[0]!.id;
}

describe('evidence -- RLS', () => {
  it('lets staff see an evidence row in their own organisation', async () => {
    const workPackageId = await insertWorkPackage();
    const [row] = await sql<{ id: string }>(
      `insert into evidence (organization_id, project_id, activity_table, activity_id, evidence_type, storage_path, responsible_user_id, created_by)
       values ($1, $2, 'work_packages', $3, 'photo', 'test/a.jpg', $4, $4) returning id`,
      [org.id, project.id, workPackageId, owner.id],
    );

    await asUser(owner.id, async (run) => {
      const rows = await run('select id from evidence where id = $1', [row!.id]);
      expect(rows).toHaveLength(1);
    });
  });

  it('hides evidence across organisations, for staff too', async () => {
    const workPackageId = await insertWorkPackage();
    const [row] = await sql<{ id: string }>(
      `insert into evidence (organization_id, project_id, activity_table, activity_id, evidence_type, storage_path, responsible_user_id, created_by)
       values ($1, $2, 'work_packages', $3, 'photo', 'test/b.jpg', $4, $4) returning id`,
      [org.id, project.id, workPackageId, owner.id],
    );

    const bOwner = await createUser({ organizationId: orgB.id, orgRole: 'owner' });
    await asUser(bOwner.id, async (run) => {
      const rows = await run('select id from evidence where id = $1', [row!.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('hides internal_only evidence from a client_approver', async () => {
    const workPackageId = await insertWorkPackage();
    const [row] = await sql<{ id: string }>(
      `insert into evidence (organization_id, project_id, activity_table, activity_id, evidence_type, storage_path, responsible_user_id, created_by, visibility)
       values ($1, $2, 'work_packages', $3, 'photo', 'test/c.jpg', $4, $4, 'internal_only') returning id`,
      [org.id, project.id, workPackageId, owner.id],
    );

    await asUser(clientApprover.id, async (run) => {
      const rows = await run('select id from evidence where id = $1', [row!.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it("lets the project's own client_approver see client_visible evidence", async () => {
    const workPackageId = await insertWorkPackage();
    const [row] = await sql<{ id: string }>(
      `insert into evidence (organization_id, project_id, activity_table, activity_id, evidence_type, storage_path, responsible_user_id, created_by, visibility)
       values ($1, $2, 'work_packages', $3, 'photo', 'test/d.jpg', $4, $4, 'client_visible') returning id`,
      [org.id, project.id, workPackageId, owner.id],
    );

    await asUser(clientApprover.id, async (run) => {
      const rows = await run('select id from evidence where id = $1', [row!.id]);
      expect(rows).toHaveLength(1);
    });
  });
});

describe('trg_photos_sync_evidence -- automatic evidence creation (ADR 0029 Decision 3)', () => {
  it('creates a matching internal_only evidence row when work_package_id is set', async () => {
    const workPackageId = await insertWorkPackage();
    await insertPhoto({ workPackageId });

    const rows = await sql<{ visibility: string; activity_table: string; activity_id: string }>(
      `select visibility, activity_table, activity_id from evidence where activity_table = 'work_packages' and activity_id = $1`,
      [workPackageId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.visibility).toBe('internal_only');
  });

  it('prefers work_package_id over daily_log_id when both are set', async () => {
    const workPackageId = await insertWorkPackage();
    const [log] = await sql<{ id: string }>(
      `insert into daily_logs (organization_id, project_id, log_date, reported_by) values ($1, $2, current_date, $3) returning id`,
      [org.id, project.id, owner.id],
    );
    await insertPhoto({ workPackageId, dailyLogId: log!.id });

    const wpRows = await sql<{ id: string }>(`select id from evidence where activity_table = 'work_packages' and activity_id = $1`, [
      workPackageId,
    ]);
    const dlRows = await sql<{ id: string }>(`select id from evidence where activity_table = 'daily_logs' and activity_id = $1`, [
      log!.id,
    ]);
    expect(wpRows).toHaveLength(1);
    expect(dlRows).toHaveLength(0);
  });

  it('creates no evidence row for a photo with none of the specific-activity FKs set', async () => {
    const before = await sql<{ count: string }>('select count(*)::text from evidence where project_id = $1', [project.id]);
    await insertPhoto({});
    const after = await sql<{ count: string }>('select count(*)::text from evidence where project_id = $1', [project.id]);
    expect(after[0]!.count).toBe(before[0]!.count);
  });
});

describe('trg_work_packages_guard_evidence -- the completion gate (ADR 0029 Decision 1+2)', () => {
  it('does not block completion when the project has no active contract yet', async () => {
    const workPackageId = await insertWorkPackage();
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);
    await expect(sql(`update work_packages set status = 'completed' where id = $1`, [workPackageId])).resolves.not.toThrow();
  });

  it('blocks completion with no evidence once the project has an active contract', async () => {
    await insertActiveContract();
    const workPackageId = await insertWorkPackage();
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);

    const error = await expectRejection(sql(`update work_packages set status = 'completed' where id = $1`, [workPackageId]));
    expect(error.message).toMatch(/Evidence belum ada/);
  });

  it('allows completion once qualifying evidence exists', async () => {
    await insertActiveContract();
    const workPackageId = await insertWorkPackage();
    await insertPhoto({ workPackageId });
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);

    await expect(sql(`update work_packages set status = 'completed' where id = $1`, [workPackageId])).resolves.not.toThrow();
  });
});

describe('evidence_overrides -- Technical Director only (ADR 0029 Decision 1, amended from Owner-only)', () => {
  it('rejects an override attempted by an owner', async () => {
    await insertActiveContract();
    const workPackageId = await insertWorkPackage();
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);

    await asUser(owner.id, async (run) => {
      const error = await expectRejection(
        run(`select fn_override_evidence_gate($1, $2)`, [workPackageId, 'Owner mencoba override']),
      );
      expect(error.message).toMatch(/Hanya Technical Director/);
    });
  });

  it('lets a technical_director override, completing the work package and recording the reason', async () => {
    await insertActiveContract();
    const workPackageId = await insertWorkPackage();
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);

    await asUser(technicalDirector.id, async (run) => {
      await run(`select fn_override_evidence_gate($1, $2)`, [workPackageId, 'Bukti menyusul, pekerjaan sudah diverifikasi langsung']);

      // asUser's transaction is rolled back once this callback returns (see
      // db.ts), so a fn_override_evidence_gate effect can only be observed
      // from a separate sql() call if we check it here, on the same
      // connection, before that rollback happens.
      const wpRows = (await run('select status from work_packages where id = $1', [workPackageId])) as {
        status: string;
      }[];
      expect(wpRows[0]!.status).toBe('completed');

      const overrideRows = (await run(
        'select reason, overridden_by from evidence_overrides where work_package_id = $1',
        [workPackageId],
      )) as { reason: string; overridden_by: string }[];
      expect(overrideRows).toHaveLength(1);
      expect(overrideRows[0]!.overridden_by).toBe(technicalDirector.id);
    });
  });

  it('mandor cannot even attempt an override -- no project role reaches evidence_overrides at all', async () => {
    await insertActiveContract();
    const workPackageId = await insertWorkPackage();
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);

    await asUser(mandor.id, async (run) => {
      await expectRejection(run(`select fn_override_evidence_gate($1, $2)`, [workPackageId, 'mandor mencoba']));
    });
  });
});

describe('client_status_updates -- RLS + publish authority (ADR 0026 §7 item 3)', () => {
  it('lets owner and technical_director publish, but rejects other org roles', async () => {
    const qs = await createUser({ organizationId: org.id, orgRole: 'qs' });

    await asUser(owner.id, async (run) => {
      await run(
        `insert into client_status_updates (organization_id, project_id, status, headline, published_by) values ($1, $2, 'on_track', 'Berjalan normal', $3)`,
        [org.id, project.id, owner.id],
      );
    });

    await asUser(technicalDirector.id, async (run) => {
      await run(
        `insert into client_status_updates (organization_id, project_id, status, headline, published_by) values ($1, $2, 'on_track', 'Berjalan normal', $3)`,
        [org.id, project.id, technicalDirector.id],
      );
    });

    await asUser(qs.id, async (run) => {
      await expectRejection(
        run(
          `insert into client_status_updates (organization_id, project_id, status, headline, published_by) values ($1, $2, 'on_track', 'Berjalan normal', $3)`,
          [org.id, project.id, qs.id],
        ),
      );
    });
  });

  it("lets the project's own client_approver read the latest status", async () => {
    // Setup via the privileged sql() connection (commits) rather than
    // asUser(owner.id, ...) -- asUser always rolls back once its callback
    // returns (db.ts), so a write made there would never be visible to the
    // separate asUser(clientApprover.id, ...) read below. The insert-side
    // RLS/publish-authority check is already covered by the sibling test
    // above; this test is only about the client_approver's read.
    await sql(
      `insert into client_status_updates (organization_id, project_id, status, headline, published_by) values ($1, $2, 'schedule_adjustment', 'Hujan menunda 2 hari', $3)`,
      [org.id, project.id, owner.id],
    );

    await asUser(clientApprover.id, async (run) => {
      const rows = await run(
        'select headline from client_status_updates where project_id = $1 order by published_at desc limit 1',
        [project.id],
      );
      expect(rows).toHaveLength(1);
    });
  });
});
