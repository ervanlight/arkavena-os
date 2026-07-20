import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, expectRejection, sql } from './db';
import { cleanupOrganizations, createOrganization, createUser, type SeedOrg, type SeedUser } from './factories';

/**
 * Proof that the audit trigger actually records changes.
 *
 * This is a Fase 0 exit criterion (ARCHITECTURE.md 7). It matters because the
 * trigger is the safety net: the application audit channel records intent, but
 * only this one catches a change made by someone who bypassed the application
 * entirely -- which is precisely the change an auditor most wants to see.
 *
 * So these tests write SQL directly, with no application code involved.
 */

const createdOrgs: string[] = [];
let org: SeedOrg;
let owner: SeedUser;

beforeAll(async () => {
  org = await createOrganization();
  createdOrgs.push(org.id);
  owner = await createUser({ organizationId: org.id, orgRole: 'owner' });
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

describe('fn_audit_row_change -- the trigger channel', () => {
  it('records an insert with the whole row as the new value', async () => {
    const user = await createUser({ organizationId: org.id, orgRole: 'finance' });

    const rows = await sql<{ action: string; new_value: Record<string, unknown>; source: string }>(
      `select action, new_value, source from audit_logs
       where entity_table = 'users' and entity_id = $1 and action = 'insert'`,
      [user.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('trigger');
    expect(rows[0]!.new_value).toMatchObject({ org_role: 'finance', organization_id: org.id });
  });

  it('records an update as a diff of only the columns that changed', async () => {
    const user = await createUser({ organizationId: org.id, orgRole: 'qs', fullName: 'Nama Lama' });

    await sql('update users set full_name = $2 where id = $1', [user.id, 'Nama Baru']);

    const rows = await sql<{
      action: string;
      previous_value: Record<string, unknown>;
      new_value: Record<string, unknown>;
    }>(
      `select action, previous_value, new_value from audit_logs
       where entity_table = 'users' and entity_id = $1 and action <> 'insert'
       order by occurred_at desc`,
      [user.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('update');

    // The diff, and nothing else. Not the whole row.
    expect(rows[0]!.previous_value).toEqual({ full_name: 'Nama Lama' });
    expect(rows[0]!.new_value).toEqual({ full_name: 'Nama Baru' });
    expect(Object.keys(rows[0]!.new_value)).toEqual(['full_name']);
  });

  it('classifies a status change as status_change, not a generic update', async () => {
    const user = await createUser({ organizationId: org.id, orgRole: 'procurement', status: 'invited' });

    await sql("update users set status = 'active' where id = $1", [user.id]);

    const rows = await sql<{ action: string; previous_value: Record<string, unknown> }>(
      `select action, previous_value from audit_logs
       where entity_table = 'users' and entity_id = $1 and action = 'status_change'`,
      [user.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.previous_value).toMatchObject({ status: 'invited' });
  });

  it('writes nothing when an update changes nothing but updated_at', async () => {
    const user = await createUser({ organizationId: org.id, orgRole: 'finance', fullName: 'Tetap' });

    const before = await countAuditRows(user.id);
    await sql('update users set full_name = $2 where id = $1', [user.id, 'Tetap']);
    const after = await countAuditRows(user.id);

    // Noise in an audit trail is not free: it buries the entries that matter.
    expect(after).toBe(before);
  });

  it('records the acting user, not just the change', async () => {
    const target = await createUser({ organizationId: org.id, orgRole: 'qs' });

    await asUser(owner.id, async (run) => {
      await run('update users set full_name = $2 where id = $1', [target.id, 'Diubah Owner']);
      // Read the audit row inside the same transaction; the rollback in asUser
      // would otherwise discard it before we could look.
      const rows = await run(
        `select actor_user_id, source from audit_logs
         where entity_table = 'users' and entity_id = $1 and action = 'update'`,
        [target.id],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.actor_user_id).toBe(owner.id);
      expect(rows[0]!.source).toBe('trigger');
    });
  });

  it('catches a change made directly in SQL, bypassing the application', async () => {
    // The reason this channel exists at all.
    const user = await createUser({ organizationId: org.id, orgRole: 'finance' });

    await sql("update users set full_name = 'Diubah Lewat psql' where id = $1", [user.id]);

    const rows = await sql(
      `select 1 from audit_logs
       where entity_table = 'users' and entity_id = $1
         and new_value ->> 'full_name' = 'Diubah Lewat psql'`,
      [user.id],
    );

    expect(rows).toHaveLength(1);
  });
});

describe('audit_logs is append-only', () => {
  it('refuses an update by the signed-in role', async () => {
    const user = await createUser({ organizationId: org.id, orgRole: 'owner' });
    const [row] = await sql<{ id: string }>(
      `select id from audit_logs where entity_id = $1 limit 1`,
      [user.id],
    );

    await asUser(user.id, async (run) => {
      const error = await expectRejection(
        run("update audit_logs set reason = 'diubah' where id = $1", [row!.id]),
      );
      expect(error.message).toMatch(/permission denied|row-level security/i);
    });
  });

  it('refuses a delete by the signed-in role', async () => {
    const user = await createUser({ organizationId: org.id, orgRole: 'owner' });
    const [row] = await sql<{ id: string }>(
      `select id from audit_logs where entity_id = $1 limit 1`,
      [user.id],
    );

    await asUser(user.id, async (run) => {
      const error = await expectRejection(run('delete from audit_logs where id = $1', [row!.id]));
      expect(error.message).toMatch(/permission denied|row-level security/i);
    });
  });

  it('refuses a direct insert, so the only way in is the audit functions', async () => {
    await asUser(owner.id, async (run) => {
      const error = await expectRejection(
        run(
          `insert into audit_logs (entity_table, entity_id, action, source, organization_id)
           values ('users', $1, 'update', 'app', $2)`,
          [owner.id, org.id],
        ),
      );
      expect(error.message).toMatch(/row-level security|permission denied/i);
    });
  });

  it('has no audit trigger on itself', async () => {
    // It would recurse, and an append-only table has nothing to audit.
    const triggers = await sql(
      `select tgname from pg_trigger
       where tgrelid = 'public.audit_logs'::regclass and not tgisinternal`,
    );
    expect(triggers).toHaveLength(0);
  });
});

describe('fn_record_audit -- the application channel', () => {
  it('requires a reason for an override', async () => {
    const error = await expectRejection(
      sql(`select fn_record_audit('purchase_orders', $1, 'override'::audit_action)`, [owner.id]),
    );
    expect(error.message).toMatch(/requires a non-empty reason/i);
  });

  it('rejects a reason that is only whitespace', async () => {
    const error = await expectRejection(
      sql(
        `select fn_record_audit('purchase_orders', $1, 'override'::audit_action,
                                '{}'::jsonb, '{}'::jsonb, '   ')`,
        [owner.id],
      ),
    );
    expect(error.message).toMatch(/requires a non-empty reason/i);
  });

  it('stores the reason and request id an override carries', async () => {
    await asUser(owner.id, async (run) => {
      await run(
        `select fn_record_audit('purchase_orders', $1, 'override'::audit_action,
                                '{}'::jsonb, '{}'::jsonb,
                                'Termin sudah cair, bukti transfer menyusul', 'req-123')`,
        [owner.id],
      );

      const rows = await run(
        `select reason, request_id, source, actor_user_id, organization_id
         from audit_logs where action = 'override' and entity_id = $1`,
        [owner.id],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        reason: 'Termin sudah cair, bukti transfer menyusul',
        request_id: 'req-123',
        source: 'app',
        actor_user_id: owner.id,
        organization_id: org.id,
      });
    });
  });

  it('allows an ordinary update with no reason', async () => {
    const rows = await sql<{ fn_record_audit: string }>(
      `select fn_record_audit('users', $1, 'update'::audit_action)`,
      [owner.id],
    );
    expect(rows[0]!.fn_record_audit).toMatch(/^[0-9a-f-]{36}$/);
  });
});

async function countAuditRows(entityId: string): Promise<number> {
  const rows = await sql<{ count: string }>(
    'select count(*)::text as count from audit_logs where entity_id = $1',
    [entityId],
  );
  return Number(rows[0]!.count);
}
