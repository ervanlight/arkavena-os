import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, expectRejection, sql } from './db';
import { cleanupOrganizations, createOrgWithStaff, createUser, type SeedOrg, type SeedUser } from './factories';

/**
 * RLS for Fase 10's one new table (ADR 0020 SS3). The "AI never writes to
 * another module's table" guarantee itself is proven at the unit-test level
 * (src/modules/ai-scribe/actions/ai-scribe-actions.test.ts, mocking the
 * Supabase client and asserting only `ai_generations` is ever touched) --
 * this file proves the ledger table's own access control, the same standard
 * every other Fase 8/9 table is held to.
 */

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let procurement: SeedUser;

let orgB: SeedOrg;
let ownerB: SeedUser;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  procurement = a.procurement;

  const b = await createOrgWithStaff();
  orgB = b.org;
  ownerB = b.owner;

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

describe('RLS -- ai_generations is staff-only, org-scoped, append-only', () => {
  it('lets staff insert and read a generation row for their own org', async () => {
    await asUser(procurement.id, async (run) => {
      const rows = await run(
        `insert into ai_generations (organization_id, feature, model, input_tokens, output_tokens, cost_amount, requested_by)
         values ($1, 'issue_classification', 'claude-haiku-4-5', 50, 10, 5, $2) returning id`,
        [org.id, procurement.id],
      );
      expect(rows).toHaveLength(1);
      expect(await run('select id from ai_generations where id = $1', [rows[0]!.id])).toHaveLength(1);
    });
  });

  it('hides ai_generations across organisations', async () => {
    const rows = await sql<{ id: string }>(
      `insert into ai_generations (organization_id, feature, model, input_tokens, output_tokens, cost_amount, requested_by)
       values ($1, 'delay_detection', 'claude-haiku-4-5', 30, 15, 3, $2) returning id`,
      [org.id, owner.id],
    );
    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from ai_generations where id = $1', [rows[0]!.id])).toHaveLength(0);
    });
  });

  it('refuses an insert from a project role (mandor)', async () => {
    const mandor = await createUser({ organizationId: org.id, orgRole: null });

    const error = await expectRejection(
      asUser(mandor.id, (run) =>
        run(
          `insert into ai_generations (organization_id, feature, model, input_tokens, output_tokens, cost_amount, requested_by)
           values ($1, 'issue_classification', 'claude-haiku-4-5', 50, 10, 5, $2)`,
          [org.id, mandor.id],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('has no UPDATE or DELETE policy for anyone -- append-only, same as audit_logs', async () => {
    const rows = await sql<{ id: string }>(
      `insert into ai_generations (organization_id, feature, model, input_tokens, output_tokens, cost_amount, requested_by)
       values ($1, 'issue_classification', 'claude-haiku-4-5', 50, 10, 5, $2) returning id`,
      [org.id, owner.id],
    );

    // No USING policy for UPDATE means the row is simply invisible to the
    // statement -- Postgres reports this as "0 rows updated", not an error
    // (expectRejection is for INSERT's WITH CHECK failing loudly; a missing
    // USING policy is silent by design, same as a SELECT that finds nothing).
    await asUser(owner.id, async (run) => {
      await run(`update ai_generations set model = 'other' where id = $1`, [rows[0]!.id]);
    });

    const after = await sql<{ model: string }>('select model from ai_generations where id = $1', [rows[0]!.id]);
    expect(after[0]!.model).toBe('claude-haiku-4-5');
  });
});
