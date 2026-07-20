import { Client, Pool } from 'pg';

/**
 * Test harness for the database layer.
 *
 * These tests exist because ARCHITECTURE.md 0.2 enforces the rules that matter
 * in two places -- the domain layer and the database -- and the database half
 * is the one that holds when the application is bypassed. Testing only the
 * TypeScript would leave the actual last line of defence unverified.
 *
 * Connection details come from `supabase start`, which prints fixed local
 * values. They are development-only credentials for a database on this machine.
 */
const CONNECTION_STRING =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: CONNECTION_STRING, max: 4 });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Run a query with full privileges, bypassing RLS. Used for setup and assertions. */
export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, values as unknown[]);
  return result.rows as T[];
}

/**
 * Run queries as a specific signed-in user, with RLS active.
 *
 * This is how the RLS tests reproduce a real session. Supabase's `auth.uid()`
 * reads `request.jwt.claims ->> 'sub'`, and the `authenticated` role is the one
 * PostgREST uses for a signed-in request -- so setting both reproduces exactly
 * the conditions a policy sees in production.
 *
 * Everything runs inside a transaction that is always rolled back, so a test
 * cannot leave state behind for the next one (ARCHITECTURE.md 2.5).
 */
export async function asUser<T>(
  userId: string,
  work: (run: RunAs) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  try {
    await client.query('begin');
    await client.query("select set_config('role', 'authenticated', true)");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);

    const run: RunAs = async (text, values = []) => {
      const result = await client.query(text, values as unknown[]);
      return result.rows as Record<string, unknown>[];
    };

    return await work(run);
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.end();
  }
}

export type RunAs = (
  text: string,
  values?: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Run several statements on one dedicated privileged connection.
 *
 * Needed whenever a statement changes session state -- `set
 * session_replication_role`, for instance. Through the pool those statements
 * could land on a different connection than the work they were meant to affect,
 * which fails intermittently and looks like a flaky test rather than a bug.
 */
export async function withPrivilegedClient<T>(work: (run: RunAs) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  try {
    const run: RunAs = async (text, values = []) => {
      const result = await client.query(text, values as unknown[]);
      return result.rows as Record<string, unknown>[];
    };
    return await work(run);
  } finally {
    await client.end();
  }
}

/** Run as an anonymous visitor -- no session at all. */
export async function asAnonymous<T>(work: (run: RunAs) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  try {
    await client.query('begin');
    await client.query("select set_config('role', 'anon', true)");

    const run: RunAs = async (text, values = []) => {
      const result = await client.query(text, values as unknown[]);
      return result.rows as Record<string, unknown>[];
    };

    return await work(run);
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.end();
  }
}

/**
 * Assert that a statement is refused.
 *
 * RLS usually denies by returning no rows rather than by raising, so a test
 * that only checks for a thrown error would pass for the wrong reason. Callers
 * assert on emptiness for SELECT and use this for writes.
 */
export async function expectRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected the statement to be rejected, but it succeeded');
}
