import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asAnonymous, asUser, closePool, expectRejection, sql } from './db';
import {
  cleanupOrganizations,
  createOrgWithStaff,
  createUser,
  type SeedOrg,
  type SeedUser,
} from './factories';

/**
 * The RLS harness (ARCHITECTURE.md 2.4, layer 3).
 *
 * Every row here corresponds to a claim in docs/rls-matrix.md. The matrix is
 * the readable version; this is the version that fails CI when a policy stops
 * matching it.
 *
 * Two organisations exist throughout. A single-tenant fixture would let every
 * one of these tests pass for the wrong reason -- there would be nothing to
 * leak from.
 */

const createdOrgs: string[] = [];

let orgA: SeedOrg;
let ownerA: SeedUser;
let financeA: SeedUser;
let externalA: SeedUser;

let orgB: SeedOrg;
let ownerB: SeedUser;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  const b = await createOrgWithStaff();

  orgA = a.org;
  ownerA = a.owner;
  financeA = a.finance;
  externalA = a.external;

  orgB = b.org;
  ownerB = b.owner;

  createdOrgs.push(orgA.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

describe('organisation isolation -- the property owner decision D1 exists for', () => {
  it('shows a user their own organisation and no other', async () => {
    await asUser(ownerA.id, async (run) => {
      const rows = await run('select id from organizations');
      expect(rows.map((r) => r.id)).toEqual([orgA.id]);
    });
  });

  it('hides the other organisation entirely, not merely from the UI', async () => {
    await asUser(ownerA.id, async (run) => {
      const rows = await run('select id from organizations where id = $1', [orgB.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('hides the other organisation users', async () => {
    await asUser(ownerA.id, async (run) => {
      const rows = await run('select id from users where organization_id = $1', [orgB.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('hides the other organisation audit trail', async () => {
    await asUser(ownerB.id, async (run) => {
      const rows = await run('select id from audit_logs where organization_id = $1', [orgA.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('will not let an owner update the other organisation', async () => {
    await asUser(ownerA.id, async (run) => {
      const result = await run("update organizations set name = 'Diambil Alih' where id = $1", [
        orgB.id,
      ]);
      expect(result).toHaveLength(0);
    });

    const [row] = await sql<{ name: string }>('select name from organizations where id = $1', [orgB.id]);
    expect(row!.name).not.toBe('Diambil Alih');
  });
});

describe('fails closed when the session is not usable', () => {
  it('shows an anonymous visitor nothing at all', async () => {
    await asAnonymous(async (run) => {
      expect(await run('select id from organizations')).toHaveLength(0);
      expect(await run('select id from users')).toHaveLength(0);
      expect(await run('select id from audit_logs')).toHaveLength(0);
    });
  });

  it('shows a soft-deleted user nothing, because fn_current_org_id returns NULL', async () => {
    // organization_id = NULL is NULL, not true, so no row matches anywhere.
    // The system fails closed by construction rather than by remembering to check.
    const ghost = await createUser({ organizationId: orgA.id, orgRole: 'owner' });
    await sql('update users set deleted_at = now() where id = $1', [ghost.id]);

    await asUser(ghost.id, async (run) => {
      expect(await run('select id from organizations')).toHaveLength(0);
      expect(await run('select id from users')).toHaveLength(0);
    });
  });

  it('shows a suspended user no audit trail', async () => {
    // fn_current_org_role() requires status = 'active', so the staff-only
    // audit policy excludes them even though their org lookup still resolves.
    const suspended = await createUser({
      organizationId: orgA.id,
      orgRole: 'owner',
      status: 'suspended',
    });

    await asUser(suspended.id, async (run) => {
      expect(await run('select id from audit_logs')).toHaveLength(0);
    });
  });
});

describe('audit trail is internal only', () => {
  it('lets internal staff read their organisation trail', async () => {
    await asUser(financeA.id, async (run) => {
      const rows = await run('select id from audit_logs limit 1');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('shows an external user nothing, even inside their own organisation', async () => {
    // externalA holds no org_role -- a client or supplier. The audit trail
    // records internal decisions and is not part of what they see.
    await asUser(externalA.id, async (run) => {
      expect(await run('select id from audit_logs')).toHaveLength(0);
    });
  });
});

describe('privilege escalation', () => {
  it('stops a user making themselves owner', async () => {
    // users_update_self allows editing your own row; RLS cannot say "every
    // column except org_role", so a trigger enforces the narrower rule.
    await asUser(financeA.id, async (run) => {
      const error = await expectRejection(
        run("update users set org_role = 'owner' where id = $1", [financeA.id]),
      );
      expect(error.message).toMatch(/only an owner may change/i);
    });

    const [row] = await sql<{ org_role: string }>('select org_role from users where id = $1', [
      financeA.id,
    ]);
    expect(row!.org_role).toBe('finance');
  });

  it('stops a user un-suspending themselves', async () => {
    const suspended = await createUser({
      organizationId: orgA.id,
      orgRole: 'finance',
      status: 'suspended',
    });

    await asUser(suspended.id, async (run) => {
      const error = await expectRejection(
        run("update users set status = 'active' where id = $1", [suspended.id]),
      );
      expect(error.message).toMatch(/only an owner may change/i);
    });
  });

  it('stops even an owner moving a user to another organisation', async () => {
    await asUser(ownerA.id, async (run) => {
      const error = await expectRejection(
        run('update users set organization_id = $2 where id = $1', [financeA.id, orgB.id]),
      );
      expect(error.message).toMatch(/cannot be moved between organisations/i);
    });
  });

  it('lets a user edit their own name, which is the point of the self policy', async () => {
    await asUser(financeA.id, async (run) => {
      const rows = await run(
        'update users set full_name = $2 where id = $1 returning full_name',
        [financeA.id, 'Nama Diperbarui'],
      );
      expect(rows[0]).toMatchObject({ full_name: 'Nama Diperbarui' });
    });
  });

  it('will not let a signed-in user create another user', async () => {
    // There is no INSERT policy on users. Provisioning uses the service role.
    await asUser(ownerA.id, async (run) => {
      const error = await expectRejection(
        run(
          `insert into users (id, organization_id, email, full_name, org_role, status)
           values (gen_random_uuid(), $1, 'penyusup@test.local', 'Penyusup', 'owner', 'active')`,
          [orgA.id],
        ),
      );
      expect(error.message).toMatch(/row-level security|violates foreign key/i);
    });
  });
});

describe('roles reference table', () => {
  it('is readable by everyone, including external users', async () => {
    await asUser(externalA.id, async (run) => {
      const rows = await run('select key from roles');
      expect(rows).toHaveLength(11);
    });
  });

  it('is writable by nobody, not even an owner', async () => {
    await asUser(ownerA.id, async (run) => {
      const error = await expectRejection(
        run("insert into roles (key, scope, name_id) values ('raja', 'organization', 'Raja')"),
      );
      expect(error.message).toMatch(/row-level security/i);
    });
  });
});

describe('notifications', () => {
  it('shows a recipient only their own', async () => {
    await sql(
      `insert into notifications (organization_id, user_id, channel, title)
       values ($1, $2, 'in_app', 'Untuk Owner'), ($1, $3, 'in_app', 'Untuk Finance')`,
      [orgA.id, ownerA.id, financeA.id],
    );

    await asUser(financeA.id, async (run) => {
      const rows = await run('select title from notifications');
      expect(rows.map((r) => r.title)).toEqual(['Untuk Finance']);
    });
  });

  it('lets a recipient mark one read but not rewrite it', async () => {
    const [row] = await sql<{ id: string }>(
      `insert into notifications (organization_id, user_id, channel, title)
       values ($1, $2, 'in_app', 'Asli') returning id`,
      [orgA.id, ownerA.id],
    );

    await asUser(ownerA.id, async (run) => {
      await run('update notifications set read_at = now() where id = $1', [row!.id]);

      const error = await expectRejection(
        run("update notifications set title = 'Dipalsukan' where id = $1", [row!.id]),
      );
      expect(error.message).toMatch(/may only mark a notification read/i);
    });
  });
});
