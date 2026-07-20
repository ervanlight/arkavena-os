/**
 * Checks that the permission matrix and the database policies still agree
 * (ARCHITECTURE.md 6.2, enforcer 1).
 *
 * The matrix in `core/permissions/matrix.ts` is meant to be the single source
 * of truth, but it is enforced by three separate mechanisms. Only one of them
 * -- RLS -- is actually load-bearing. So the failure this guards against is
 * specific: the matrix says a role may do something, the guard agrees, the UI
 * shows the button, and the policy underneath says otherwise. Or worse, the
 * reverse: the matrix is tightened, everyone believes access was removed, and
 * the policy still allows it.
 *
 * What this can and cannot do is worth being precise about. It compares role
 * names appearing in policy expressions against the eleven known roles, and
 * checks that every resource in the matrix has a table with matching policies.
 * It does not attempt to prove the two are semantically equivalent -- that is
 * what `supabase/tests/rls.test.ts` is for, by signing in and observing what
 * each role can actually reach. This script catches drift; the tests catch
 * behaviour.
 *
 * Requires a running local Supabase.
 */
import { Client } from 'pg';
import { ALL_ROLES, PERMISSIONS, type Resource } from '../src/core/permissions/matrix';

const CONNECTION_STRING =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Which table backs which matrix resource.
 *
 * Declared rather than derived by pluralising: a guessed mapping fails silently
 * the first time a name is irregular, and silence is the one thing this script
 * must not produce.
 */
const RESOURCE_TABLES: Record<Resource, string> = {
  organization: 'organizations',
  user: 'users',
  role: 'roles',
  audit_log: 'audit_logs',
  notification: 'notifications',
};

/** Matrix actions that map onto a SQL command the policy list should cover. */
const ACTION_COMMANDS: Record<string, 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'> = {
  view: 'SELECT',
  update: 'UPDATE',
  invite: 'INSERT',
  mark_read: 'UPDATE',
};

type Policy = { tablename: string; policyname: string; cmd: string; qual: string | null; withCheck: string | null };

async function loadPolicies(client: Client): Promise<Policy[]> {
  const result = await client.query(
    `select tablename, policyname, cmd, qual, with_check as "withCheck"
     from pg_policies
     where schemaname = 'public'
     order by tablename, policyname`,
  );
  return result.rows as Policy[];
}

function main(): void {
  const client = new Client({ connectionString: CONNECTION_STRING });
  const problems: string[] = [];
  const notes: string[] = [];

  client
    .connect()
    .then(async () => {
      const policies = await loadPolicies(client);
      const byTable = new Map<string, Policy[]>();
      for (const policy of policies) {
        const list = byTable.get(policy.tablename) ?? [];
        list.push(policy);
        byTable.set(policy.tablename, list);
      }

      // 1. Every resource in the matrix must have a table with policies.
      for (const [resource, table] of Object.entries(RESOURCE_TABLES)) {
        const tablePolicies = byTable.get(table);
        if (tablePolicies === undefined || tablePolicies.length === 0) {
          problems.push(`matrix resource "${resource}" maps to table "${table}", which has no RLS policy`);
        }
      }

      // 2. Every role named in a policy expression must be one of the eleven.
      //    A typo here reads as a working policy and silently grants nothing.
      const knownRoles = new Set<string>(ALL_ROLES);
      const roleLiteral = /'([a-z_]+)'::(?:org_role|project_role)/g;

      for (const policy of policies) {
        const expression = `${policy.qual ?? ''} ${policy.withCheck ?? ''}`;
        for (const match of expression.matchAll(roleLiteral)) {
          const role = match[1]!;
          if (!knownRoles.has(role)) {
            problems.push(
              `policy ${policy.tablename}.${policy.policyname} references role "${role}", ` +
                'which is not in core/permissions/matrix.ts',
            );
          }
        }
      }

      // 3. Where the matrix grants an action to at least one role, a policy for
      //    the corresponding command should exist. An empty role list is a
      //    deliberate "nobody", so it is skipped.
      for (const [resource, actions] of Object.entries(PERMISSIONS)) {
        const table = RESOURCE_TABLES[resource as Resource];
        const tablePolicies = byTable.get(table) ?? [];

        for (const [action, roles] of Object.entries(actions)) {
          if ((roles as readonly string[]).length === 0) continue;

          const command = ACTION_COMMANDS[action];
          if (command === undefined) {
            notes.push(`no SQL command mapped for ${resource}.${action} -- not checked`);
            continue;
          }

          const covered = tablePolicies.some((p) => p.cmd === command || p.cmd === 'ALL');
          if (!covered) {
            problems.push(
              `matrix allows ${resource}.${action} (${command}) for ` +
                `${(roles as readonly string[]).join(', ')}, but ${table} has no ${command} policy`,
            );
          }
        }
      }

      await client.end();

      for (const note of notes) {
        process.stdout.write(`  note: ${note}\n`);
      }

      if (problems.length > 0) {
        process.stderr.write(
          `\nThe permission matrix and the RLS policies disagree (${problems.length}):\n\n` +
            problems.map((p) => `  - ${p}`).join('\n') +
            '\n\nFix the policy or the matrix. They are meant to be one decision\n' +
            'expressed twice, not two decisions that happen to be similar.\n',
        );
        process.exitCode = 1;
        return;
      }

      process.stdout.write(
        `matrix.ts and pg_policies agree across ${Object.keys(RESOURCE_TABLES).length} resources ` +
          `and ${policies.length} policies.\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `Could not check policies: ${error instanceof Error ? error.message : String(error)}\n` +
          'Is the local Supabase running? Try: pnpm db:start\n',
      );
      process.exitCode = 1;
    });
}

main();
