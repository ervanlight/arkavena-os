import { afterAll, describe, expect, it } from 'vitest';
import { closePool, sql } from './db';
import { ORG_ROLES, PROJECT_ROLES } from '@/core/permissions/matrix';
import { REASON_REQUIRED_ACTIONS } from '@/core/audit/types';

/**
 * Structural guardrails.
 *
 * These do not test behaviour; they test that the rules of the architecture are
 * still true of the schema as a whole. Their value is in what they catch *next
 * year* -- a table added in Fase 7 without RLS, an enum extended without the
 * matrix being updated -- long after everyone has stopped consciously
 * remembering the rule.
 *
 * CLAUDE.md law 6: a table without RLS is a CI failure, not a review comment.
 */

afterAll(async () => {
  await closePool();
});

/**
 * Tables exempt from the "must have organization_id" rule (owner decision D1).
 *
 * This list is deliberately a list, not a convention. Adding to it is a visible
 * diff in a pull request, which is the moment someone should ask whether the
 * exemption is really justified. See ADR 0005.
 */
const ORG_ID_EXEMPT = new Set([
  // Its own id *is* the organisation id.
  'organizations',
  // Global reference data, identical for every tenant, changed only by
  // migration. Per-tenant copies would be eleven identical rows that must never
  // diverge.
  'roles',
  // Nullable rather than absent: audit rows for global tables such as roles
  // legitimately have no organisation. Checked separately below.
  'audit_logs',
]);

/** Tables exempt from carrying the generic audit trigger. */
const AUDIT_TRIGGER_EXEMPT = new Set([
  // Auditing the audit table would recurse, and it is append-only anyway.
  'audit_logs',
]);

async function publicTables(): Promise<string[]> {
  const rows = await sql<{ tablename: string }>(
    `select tablename from pg_tables
     where schemaname = 'public'
     order by tablename`,
  );
  return rows.map((r) => r.tablename);
}

describe('every table is protected', () => {
  it('has row level security enabled', async () => {
    const rows = await sql<{ tablename: string }>(
      `select c.relname as tablename
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
       order by 1`,
    );

    expect(
      rows.map((r) => r.tablename),
      'These tables have no RLS. Every table needs it -- CLAUDE.md law 6.',
    ).toEqual([]);
  });

  it('has at least one policy, so RLS is not just denying everything by accident', async () => {
    // RLS enabled with zero policies denies all access. That is safe, but it is
    // almost always an unfinished migration rather than an intention.
    const tables = await publicTables();
    const rows = await sql<{ tablename: string }>(
      `select distinct tablename from pg_policies where schemaname = 'public'`,
    );
    const withPolicies = new Set(rows.map((r) => r.tablename));

    const missing = tables.filter((t) => !withPolicies.has(t));
    expect(missing, 'These tables have RLS but no policy at all').toEqual([]);
  });

  it('carries organization_id, or is on the exemption list', async () => {
    const tables = await publicTables();
    const rows = await sql<{ table_name: string }>(
      `select table_name from information_schema.columns
       where table_schema = 'public' and column_name = 'organization_id'`,
    );
    const scoped = new Set(rows.map((r) => r.table_name));

    const missing = tables.filter((t) => !scoped.has(t) && !ORG_ID_EXEMPT.has(t));
    expect(
      missing,
      'Owner decision D1: organization_id on every table from the first migration. ' +
        'If an exemption is genuinely right, add it to ORG_ID_EXEMPT with a reason.',
    ).toEqual([]);
  });

  it('has the audit trigger installed', async () => {
    const tables = await publicTables();
    const rows = await sql<{ tablename: string }>(
      `select c.relname as tablename
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and not t.tgisinternal and t.tgname like 'trg_%_audit'`,
    );
    const audited = new Set(rows.map((r) => r.tablename));

    const missing = tables.filter((t) => !audited.has(t) && !AUDIT_TRIGGER_EXEMPT.has(t));
    expect(missing, 'Every audited table must call fn_install_standard_triggers').toEqual([]);
  });

  it('maintains updated_at wherever the column exists', async () => {
    const withColumn = await sql<{ table_name: string }>(
      `select table_name from information_schema.columns
       where table_schema = 'public' and column_name = 'updated_at'`,
    );
    const withTrigger = await sql<{ tablename: string }>(
      `select c.relname as tablename
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and not t.tgisinternal and t.tgname like 'trg_%_set_updated_at'`,
    );
    const triggered = new Set(withTrigger.map((r) => r.tablename));

    const missing = withColumn.map((r) => r.table_name).filter((t) => !triggered.has(t));
    expect(missing, 'updated_at without its trigger is a column that silently goes stale').toEqual([]);
  });
});

describe('audit_logs cannot be rewritten', () => {
  it('has no UPDATE or DELETE policy for any role', async () => {
    const rows = await sql<{ policyname: string; cmd: string }>(
      `select policyname, cmd from pg_policies
       where schemaname = 'public' and tablename = 'audit_logs'
         and cmd in ('UPDATE', 'DELETE', 'ALL')`,
    );

    expect(rows, 'audit_logs must be append-only for everyone -- ARCHITECTURE.md 5.2').toEqual([]);
  });

  it('has UPDATE and DELETE revoked at the grant level too', async () => {
    // Belt and braces: a future migration adding a policy by mistake still
    // could not grant what the role does not hold.
    const rows = await sql<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'audit_logs'
         and grantee in ('authenticated', 'anon')
         and privilege_type in ('UPDATE', 'DELETE')`,
    );

    expect(rows.map((r) => r.privilege_type)).toEqual([]);
  });
});

describe('the code and the database agree', () => {
  it('has exactly the roles the permission matrix knows about', async () => {
    // Checked in both directions. A role added to an enum but not to the matrix
    // would be invisible to the guard; one added to the matrix but not the enum
    // could never be assigned.
    const rows = await sql<{ key: string }>('select key from roles order by key');
    const inDatabase = rows.map((r) => r.key).sort();
    const inCode = [...ORG_ROLES, ...PROJECT_ROLES].sort();

    expect(inDatabase).toEqual(inCode);
  });

  it('has roles whose scope matches which enum they belong to', async () => {
    const rows = await sql<{ key: string; scope: string }>('select key, scope from roles');

    for (const row of rows) {
      const expected = (ORG_ROLES as readonly string[]).includes(row.key) ? 'organization' : 'project';
      expect(row.scope, `role "${row.key}" has the wrong scope`).toBe(expected);
    }
  });

  it('has an org_role enum matching ORG_ROLES in core/permissions', async () => {
    const rows = await sql<{ value: string }>(
      `select unnest(enum_range(null::org_role))::text as value`,
    );
    expect(rows.map((r) => r.value).sort()).toEqual([...ORG_ROLES].sort());
  });

  it('has a project_role enum matching PROJECT_ROLES in core/permissions', async () => {
    const rows = await sql<{ value: string }>(
      `select unnest(enum_range(null::project_role))::text as value`,
    );
    expect(rows.map((r) => r.value).sort()).toEqual([...PROJECT_ROLES].sort());
  });

  it('requires a reason for exactly the actions core/audit requires one for', async () => {
    // The rule lives in three places by design. This asserts they say the same
    // thing, so one cannot be relaxed without the others noticing.
    const [row] = await sql<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint where conname = 'ck_audit_logs_reason_required'`,
    );

    expect(row).toBeDefined();
    for (const action of REASON_REQUIRED_ACTIONS) {
      expect(row!.definition, `constraint does not cover "${action}"`).toContain(action);
    }
  });
});

describe('foreign keys are explicit about deletion', () => {
  it('never uses CASCADE outside a pure child relationship', async () => {
    // ARCHITECTURE.md 2.1: RESTRICT is the default because construction records
    // should not disappear because a parent row did.
    const rows = await sql<{ conname: string; table_name: string }>(
      `select con.conname, cl.relname as table_name
       from pg_constraint con
       join pg_class cl on cl.oid = con.conrelid
       join pg_namespace n on n.oid = cl.relnamespace
       where n.nspname = 'public' and con.contype = 'f' and con.confdeltype = 'c'`,
    );

    // No Wave 0-1 table has a pure-child relationship yet. When one arrives
    // (estimate_items belonging to estimates, for instance), add it here with a
    // note rather than loosening the check.
    expect(rows.map((r) => `${r.table_name}.${r.conname}`)).toEqual([]);
  });
});
