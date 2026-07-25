import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, expectRejection, sql } from './db';
import { cleanupOrganizations, createOrgWithStaff, type SeedOrg, type SeedUser } from './factories';

/**
 * Integration/DB tests for `notifications` (Wave 1, activated by Phase 3 F11).
 * The table and its RLS/guard trigger existed since Wave 1 but had no test
 * coverage until this module actually started writing to it -- CLAUDE.md 0.6
 * requires every table to have RLS + a test, same discipline as every other
 * table in this suite.
 */

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let finance: SeedUser;

let orgB: SeedOrg;
let ownerB: SeedUser;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  finance = a.finance;

  const b = await createOrgWithStaff();
  orgB = b.org;
  ownerB = b.owner;

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function insertNotification(organizationId: string, userId: string, title = 'Cash Gate merah'): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into notifications (organization_id, user_id, channel, status, title, entity_table, entity_id, sent_at)
     values ($1, $2, 'in_app', 'sent', $3, 'cash_gate_attention', gen_random_uuid(), now()) returning id`,
    [organizationId, userId, title],
  );
  return rows[0]!.id;
}

describe('notifications -- RLS (recipient only)', () => {
  it("lets a user see their own notification, hides another user's in the same org", async () => {
    const ownId = await insertNotification(org.id, owner.id);
    const otherId = await insertNotification(org.id, finance.id);

    await asUser(owner.id, async (run) => {
      expect(await run('select id from notifications where id = $1', [ownId])).toHaveLength(1);
      expect(await run('select id from notifications where id = $1', [otherId])).toHaveLength(0);
    });
  });

  it('hides a notification across organisations, even for the same-shaped recipient', async () => {
    const idB = await insertNotification(orgB.id, ownerB.id);

    await asUser(owner.id, async (run) => {
      expect(await run('select id from notifications where id = $1', [idB])).toHaveLength(0);
    });
  });

  it('lets the recipient mark their own notification read', async () => {
    const id = await insertNotification(org.id, owner.id);

    await asUser(owner.id, async (run) => {
      await run(`update notifications set status = 'read', read_at = now() where id = $1`, [id]);
      const rows = await run('select status, read_at from notifications where id = $1', [id]);
      expect(rows[0]!.status).toBe('read');
      expect(rows[0]!.read_at).not.toBeNull();
    });
  });

  it("rejects a different user's attempt to mark someone else's notification read (RLS, not just the guard trigger)", async () => {
    const id = await insertNotification(org.id, owner.id);

    // finance can't even see owner's notification (notifications_select_own),
    // so this UPDATE's own USING clause affects zero rows -- confirmed via a
    // privileged connection, since finance has no visibility to check with.
    await asUser(finance.id, (run) => run(`update notifications set status = 'read', read_at = now() where id = $1`, [id]));
    const rows = await sql('select status from notifications where id = $1', [id]);
    expect(rows[0]!.status).toBe('sent');
  });
});

describe('fn_notifications_guard_recipient_edits -- a recipient may only mark read, not rewrite content', () => {
  it('rejects a recipient trying to change the title of their own notification', async () => {
    const id = await insertNotification(org.id, owner.id);

    const error = await expectRejection(
      asUser(owner.id, (run) => run(`update notifications set title = 'Diubah sendiri' where id = $1`, [id])),
    );
    expect(error.message).toMatch(/only mark.*read/i);
  });

  it('rejects a recipient trying to reassign a notification to themselves via user_id', async () => {
    const id = await insertNotification(org.id, finance.id);

    const error = await expectRejection(
      asUser(finance.id, (run) => run(`update notifications set user_id = $2 where id = $1`, [id, owner.id])),
    );
    expect(error.message).toMatch(/only mark.*read/i);
  });

  it('still allows status/read_at together with no other column changed', async () => {
    const id = await insertNotification(org.id, owner.id);

    await sql(`update notifications set status = 'read', read_at = now() where id = $1`, [id]);
    const rows = await sql<{ status: string }>('select status from notifications where id = $1', [id]);
    expect(rows[0]!.status).toBe('read');
  });
});
