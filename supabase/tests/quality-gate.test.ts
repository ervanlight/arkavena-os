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
 * Integration/DB tests for Fase 5's Quality Gate (QG8, ARCHITECTURE.md 0.2 /
 * Bab 4.5's "trigger genuinely rejects" requirement, ADR 0014). Same
 * discipline as cash-gate.test.ts/scope-variation.test.ts: write SQL
 * directly, proving the database itself refuses, independent of any
 * application code that could be bypassed.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let technicalDirector: SeedUser;
let mandor: SeedUser; // a project role -- should see none of this
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

  const b = await createOrgWithStaff();
  orgB = b.org;

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function insertHoldPointTemplate(workType: string, name = 'Flood test'): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into hold_point_templates (organization_id, work_type, name) values ($1, $2, $3) returning id`,
    [org.id, workType, name],
  );
  return rows[0]!.id;
}

async function insertWorkPackage(workType: string | null): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into work_packages (organization_id, project_id, name, work_type) values ($1, $2, 'Pasang keramik', $3) returning id`,
    [org.id, project.id, workType],
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

describe('hold_point_templates / inspections / nonconformities -- RLS (staff-only, no project role at all)', () => {
  it('lets staff see a hold point template in their own organisation', async () => {
    const templateId = await insertHoldPointTemplate('waterproofing_rls_1');
    await asUser(owner.id, async (run) => {
      const rows = await run('select id from hold_point_templates where id = $1', [templateId]);
      expect(rows).toHaveLength(1);
    });
  });

  it('hides a hold point template across organisations, for staff too', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into hold_point_templates (organization_id, work_type, name) values ($1, 'waterproofing', 'Flood test') returning id`,
      [orgB.id],
    );
    await asUser(owner.id, async (run) => {
      const rows = await run('select id from hold_point_templates where id = $1', [row!.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it("refuses a mandor -- a real project role -- any access at all, unlike Fase 4's field-reporting tables", async () => {
    const templateId = await insertHoldPointTemplate('waterproofing_rls_2');
    await asUser(mandor.id, async (run) => {
      const rows = await run('select id from hold_point_templates where id = $1', [templateId]);
      expect(rows).toHaveLength(0);
    });

    const workPackageId = await insertWorkPackage(null);
    const zoneId = await insertZone();
    const error = await expectRejection(
      asUser(mandor.id, (run) =>
        run(`insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id) values ($1, $2, $3, $4, $5)`, [
          org.id,
          project.id,
          workPackageId,
          zoneId,
          templateId,
        ]),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });
});

describe('trg_work_packages_guard_hold_point -- the real DB-layer block', () => {
  it('rejects moving a work package to in_progress when its required hold point has no passing/overridden inspection', async () => {
    const workType = 'waterproofing_block_1';
    await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);

    const error = await expectRejection(
      sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]),
    );
    expect(error.message).toMatch(/hold point belum lulus/i);
  });

  it('allows the transition once a passing inspection exists for that exact work package + template', async () => {
    const workType = 'waterproofing_block_2';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    await sql(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'passed')`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );

    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);
    const rows = await sql<{ status: string }>('select status from work_packages where id = $1', [workPackageId]);
    expect(rows[0]!.status).toBe('in_progress');
  });

  it('allows the transition when the inspection failed but was overridden, without requiring status = passed', async () => {
    const workType = 'waterproofing_block_3';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    const [inspection] = await sql<{ id: string }>(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'failed') returning id`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );
    await sql(
      `update inspections set overridden_by = $2, override_reason = 'Dites ulang manual, aman' where id = $1`,
      [inspection!.id, technicalDirector.id],
    );

    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);
    const rows = await sql<{ status: string }>('select status from work_packages where id = $1', [workPackageId]);
    expect(rows[0]!.status).toBe('in_progress');
  });

  it('lets a work package with no work_type through untouched -- no hold-point requirement applies', async () => {
    const workPackageId = await insertWorkPackage(null);
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);
    const rows = await sql<{ status: string }>('select status from work_packages where id = $1', [workPackageId]);
    expect(rows[0]!.status).toBe('in_progress');
  });
});

describe('fn_inspections_guard_td_only_override -- ARCHITECTURE.md 4.4\'s "Technical Director only"', () => {
  it('rejects an override attributed to a non-TD user, even an Owner', async () => {
    const workType = 'waterproofing_override_1';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    const [inspection] = await sql<{ id: string }>(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'failed') returning id`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );

    const error = await expectRejection(
      sql(`update inspections set overridden_by = $2, override_reason = 'Coba lewat' where id = $1`, [
        inspection!.id,
        owner.id,
      ]),
    );
    expect(error.message).toMatch(/hanya technical director/i);
  });

  it('accepts an override attributed to a real technical_director', async () => {
    const workType = 'waterproofing_override_2';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    const [inspection] = await sql<{ id: string }>(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'failed') returning id`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );

    await sql(`update inspections set overridden_by = $2, override_reason = 'Aman, lanjut' where id = $1`, [
      inspection!.id,
      technicalDirector.id,
    ]);

    const rows = await sql<{ overridden_by: string }>('select overridden_by from inspections where id = $1', [
      inspection!.id,
    ]);
    expect(rows[0]!.overridden_by).toBe(technicalDirector.id);
  });
});

describe('the two gates are independent (Bab 4.5: cash gate merah tetap memblokir walau semua QC lulus)', () => {
  it('still blocks in_progress on a red Cash Gate even though the hold point has passed', async () => {
    const workType = 'waterproofing_gate_1';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    await sql(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'passed')`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );

    // A real, unmet cash need -- makes fn_cash_gate_status red for this project.
    await sql(
      `insert into cash_forecasts (organization_id, project_id, needed_amount, needed_by_date)
       values ($1, $2, 50000000, current_date)`,
      [org.id, project.id],
    );

    const error = await expectRejection(
      sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]),
    );
    expect(error.message).toMatch(/cash gate/i);
  });
});

describe('audit trail -- fn_audit_row_change fires for these tables too', () => {
  it('records an insert row for a new inspection', async () => {
    const workType = 'waterproofing_audit_1';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    const [inspection] = await sql<{ id: string }>(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id)
       values ($1, $2, $3, $4, $5) returning id`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );

    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'inspections' and entity_id = $1 and action = 'insert' and source = 'trigger'`,
      [inspection!.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('records an update row for a TD override', async () => {
    const workType = 'waterproofing_audit_2';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    const [inspection] = await sql<{ id: string }>(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'failed') returning id`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );
    await sql(`update inspections set overridden_by = $2, override_reason = 'Audit check' where id = $1`, [
      inspection!.id,
      technicalDirector.id,
    ]);

    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'inspections' and entity_id = $1 and action = 'update' and source = 'trigger'`,
      [inspection!.id],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('records a nonconformity insert', async () => {
    const workType = 'waterproofing_audit_3';
    const templateId = await insertHoldPointTemplate(workType);
    const workPackageId = await insertWorkPackage(workType);
    const zoneId = await insertZone();

    const [inspection] = await sql<{ id: string }>(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'failed') returning id`,
      [org.id, project.id, workPackageId, zoneId, templateId],
    );

    const [nonconformity] = await sql<{ id: string }>(
      `insert into nonconformities (organization_id, inspection_id, description) values ($1, $2, 'Genangan air di sudut kamar mandi') returning id`,
      [org.id, inspection!.id],
    );

    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'nonconformities' and entity_id = $1 and action = 'insert' and source = 'trigger'`,
      [nonconformity!.id],
    );
    expect(rows).toHaveLength(1);
  });
});
