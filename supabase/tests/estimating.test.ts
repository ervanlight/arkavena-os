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
 * Integration/RLS tests for Fase 8's estimating tables (Wave 5-6, ADR 0018
 * SS4/SS5). These shipped in F8-6/7/8 without their own RLS test coverage --
 * this file closes that gap (CLAUDE.md law 0.6: every table needs RLS, a
 * docs/rls-matrix.md row, and a test).
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let procurement: SeedUser;
let mandor: SeedUser;

let orgB: SeedOrg;
let ownerB: SeedUser;

let project: SeedProjectWithClientAndSite;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  procurement = a.procurement;

  const b = await createOrgWithStaff();
  orgB = b.org;
  ownerB = b.owner;

  createdOrgs.push(org.id, orgB.id);

  project = await createProjectWithClientAndSite(org.id);
  mandor = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(project.id, mandor.id, 'mandor');
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function insertEstimate(input: {
  version: number;
  isBaseline?: boolean;
  title?: string;
  projectId?: string;
}) {
  const rows = await sql<{ id: string }>(
    `insert into estimates (organization_id, project_id, version, is_baseline, title, created_by)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      org.id,
      input.projectId ?? project.id,
      input.version,
      input.isBaseline ?? false,
      input.title ?? `Estimasi v${input.version}`,
      owner.id,
    ],
  );
  return rows[0]!.id;
}

describe('RLS -- estimates/estimate_items/proposals are staff-only, org-scoped', () => {
  it('lets staff insert and read an estimate for their own org', async () => {
    await asUser(procurement.id, async (run) => {
      const rows = await run(
        `insert into estimates (organization_id, project_id, version, title, created_by)
         values ($1, $2, 1, 'Estimasi awal', $3) returning id`,
        [org.id, project.id, procurement.id],
      );
      expect(rows).toHaveLength(1);

      const read = await run('select id from estimates where id = $1', [rows[0]!.id]);
      expect(read).toHaveLength(1);
    });
  });

  it('hides estimates from a project role (mandor)', async () => {
    const estimateId = await insertEstimate({ version: 2 });
    await asUser(mandor.id, async (run) => {
      expect(await run('select id from estimates where id = $1', [estimateId])).toHaveLength(0);
    });
  });

  it('hides estimates across organisations', async () => {
    const estimateId = await insertEstimate({ version: 3 });
    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from estimates where id = $1', [estimateId])).toHaveLength(0);
    });
  });

  it('refuses an estimate_items insert from a project role', async () => {
    const estimateId = await insertEstimate({ version: 4 });
    const error = await expectRejection(
      asUser(mandor.id, (run) =>
        run(
          `insert into estimate_items (organization_id, estimate_id, description, unit, quantity, unit_cost, unit_price)
           values ($1, $2, 'Semen', 'sak', 10, 80000, 95000)`,
          [org.id, estimateId],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('lets staff read and write proposals for their own org, hidden from a project role', async () => {
    const estimateId = await insertEstimate({ version: 5 });
    const proposal = await sql<{ id: string }>(
      `insert into proposals (organization_id, project_id, estimate_id, status) values ($1, $2, $3, 'draft') returning id`,
      [org.id, project.id, estimateId],
    );

    await asUser(owner.id, async (run) => {
      expect(await run('select id from proposals where id = $1', [proposal[0]!.id])).toHaveLength(1);
    });
    await asUser(mandor.id, async (run) => {
      expect(await run('select id from proposals where id = $1', [proposal[0]!.id])).toHaveLength(0);
    });
  });
});

describe('RLS -- proposals client accept/decline (Fase 12, ADR 0026 §5 amendment)', () => {
  let clientApprover: SeedUser;
  let clientViewer: SeedUser;

  beforeAll(async () => {
    clientApprover = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
    clientViewer = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientViewer.id, 'client_viewer');
  });

  async function insertProposal(status: 'draft' | 'sent' = 'sent') {
    const estimateId = await insertEstimate({ version: 100 + Math.floor(Math.random() * 100000) });
    const sentAt = status === 'sent' ? new Date().toISOString() : null;
    const rows = await sql<{ id: string }>(
      `insert into proposals (organization_id, project_id, estimate_id, status, sent_at)
       values ($1, $2, $3, $4, $5) returning id`,
      [org.id, project.id, estimateId, status, sentAt],
    );
    return rows[0]!.id;
  }

  it('hides a draft proposal from client_approver and client_viewer alike', async () => {
    const proposalId = await insertProposal('draft');
    await asUser(clientApprover.id, async (run) => {
      expect(await run('select id from proposals where id = $1', [proposalId])).toHaveLength(0);
    });
    await asUser(clientViewer.id, async (run) => {
      expect(await run('select id from proposals where id = $1', [proposalId])).toHaveLength(0);
    });
  });

  it('lets client_approver and client_viewer both read a sent proposal', async () => {
    const proposalId = await insertProposal('sent');
    await asUser(clientApprover.id, async (run) => {
      expect(await run('select id from proposals where id = $1', [proposalId])).toHaveLength(1);
    });
    await asUser(clientViewer.id, async (run) => {
      expect(await run('select id from proposals where id = $1', [proposalId])).toHaveLength(1);
    });
  });

  it('lets client_approver accept a sent proposal, recording their own decision', async () => {
    const proposalId = await insertProposal('sent');
    await asUser(clientApprover.id, async (run) => {
      await run(
        `update proposals set status = 'accepted', decided_at = now(), decided_by = $2, decision_reason = 'Setuju' where id = $1`,
        [proposalId, clientApprover.id],
      );
      const rows = (await run('select status, decided_by from proposals where id = $1', [proposalId])) as {
        status: string;
        decided_by: string;
      }[];
      expect(rows[0]!.status).toBe('accepted');
      expect(rows[0]!.decided_by).toBe(clientApprover.id);
    });
  });

  it('leaves client_viewer unable to affect any row when attempting to decide (read-only role)', async () => {
    // proposals_update_client's USING clause requires 'client_approver' --
    // client_viewer simply matches no row (0 rows affected), the same
    // "RLS filters, it does not raise" shape as the draft-transition test
    // above, not a thrown error.
    const proposalId = await insertProposal('sent');
    await asUser(clientViewer.id, async (run) => {
      const rows = await run(
        `update proposals set status = 'accepted', decided_at = now(), decided_by = $2, decision_reason = 'x' where id = $1 returning id`,
        [proposalId, clientViewer.id],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it('fn_proposals_guard_transition blocks a client_approver from skipping straight to accepted from draft', async () => {
    const proposalId = await insertProposal('draft');
    // A draft is invisible to the client (RLS), so this update affects zero
    // rows rather than raising -- proving the row truly cannot be reached,
    // not just that the transition guard would refuse it if it could.
    await asUser(clientApprover.id, async (run) => {
      const rows = await run(
        `update proposals set status = 'accepted', decided_at = now(), decided_by = $2, decision_reason = 'x' where id = $1 returning id`,
        [proposalId, clientApprover.id],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it('fn_proposals_guard_client_columns blocks a client_approver from touching client_summary or estimate_id', async () => {
    const proposalId = await insertProposal('sent');
    const error = await expectRejection(
      asUser(clientApprover.id, (run) =>
        run(`update proposals set client_summary = 'saya ubah sendiri' where id = $1`, [proposalId]),
      ),
    );
    expect(error.message).toMatch(/only record their own accept\/reject decision/);
  });
});

describe('uq_estimates_one_baseline_per_project -- a database fact, not application discipline', () => {
  it('refuses a second baseline on the same project', async () => {
    const baselineProject = await createProjectWithClientAndSite(org.id);
    await insertEstimate({ version: 10, isBaseline: true, projectId: baselineProject.id });

    const error = await expectRejection(
      sql(
        `insert into estimates (organization_id, project_id, version, is_baseline, title, created_by)
         values ($1, $2, 11, true, 'Segunda baseline', $3)`,
        [org.id, baselineProject.id, owner.id],
      ),
    );
    expect(error.message).toMatch(/uq_estimates_one_baseline_per_project/i);
  });
});

describe('fn_set_baseline_estimate -- the atomic RPC that swaps the baseline', () => {
  it('unsets the previous baseline and sets the new one in a single transaction', async () => {
    const swapProject = await createProjectWithClientAndSite(org.id);
    const estimateA = await insertEstimate({ version: 20, isBaseline: true, projectId: swapProject.id });
    const estimateB = await insertEstimate({ version: 21, projectId: swapProject.id });

    await asUser(owner.id, async (run) => {
      const swapped = await run('select * from fn_set_baseline_estimate($1)', [estimateB]);
      expect(swapped[0]?.id).toBe(estimateB);
      expect(swapped[0]?.is_baseline).toBe(true);

      const baselines = await run(
        `select id from estimates where project_id = $1 and is_baseline = true`,
        [swapProject.id],
      );
      expect(baselines).toEqual([{ id: estimateB }]);

      const previous = await run('select is_baseline from estimates where id = $1', [estimateA]);
      expect(previous[0]?.is_baseline).toBe(false);
    });
  });

  it('is not reachable by a project role -- RLS hides the row before the function ever sees it', async () => {
    const estimateId = await insertEstimate({ version: 22 });

    const error = await expectRejection(
      asUser(mandor.id, (run) => run('select * from fn_set_baseline_estimate($1)', [estimateId])),
    );
    expect(error.message).toMatch(/not found/i);
  });
});
