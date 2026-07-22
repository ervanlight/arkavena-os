import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sql } from '../../supabase/tests/db';

/**
 * E2E-specific user creation -- deliberately NOT supabase/tests/factories.ts's
 * `createUser`, which inserts straight into `auth.users` via SQL. That is
 * exactly right for its own purpose (RLS tests set JWT claims manually via
 * `asUser()` and never call GoTrue at all), but `signInAs` needs
 * `admin.auth.admin.generateLink`, which is a real GoTrue Admin API call --
 * and GoTrue 500s on it for a user who never went through a real signup/
 * admin-create path, because the identity row that path populates is
 * missing. Confirmed by hand while this suite was first failing with an
 * opaque `AuthRetryableFetchError: {}`.
 *
 * Org/project/site/client creation has no such problem (no auth.users
 * involved), so those still come straight from supabase/tests/factories.ts.
 */

function adminClient() {
  return createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${name} for the e2e suite.`);
  }
  return value;
}

export type E2eUser = { id: string; email: string };

async function createAuthUser(label: string): Promise<E2eUser> {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@test.local`;
  const { data, error } = await adminClient().auth.admin.createUser({ email, email_confirm: true });
  if (error !== null) throw error;
  return { id: data.user.id, email };
}

/** A staff member -- one of the five org_role values. */
export async function createStaffUser(organizationId: string, orgRole: string, label: string): Promise<E2eUser> {
  const user = await createAuthUser(label);
  await sql(
    `insert into users (id, organization_id, email, full_name, org_role, status)
     values ($1, $2, $3, $4, $5::org_role, 'active'::user_status)`,
    [user.id, organizationId, user.email, label, orgRole],
  );
  return user;
}

/** A project-role-only user (mandor, client_approver, ...) -- no org_role at all. */
export async function createExternalUser(organizationId: string, label: string): Promise<E2eUser> {
  const user = await createAuthUser(label);
  await sql(
    `insert into users (id, organization_id, email, full_name, org_role, status)
     values ($1, $2, $3, $4, null, 'active'::user_status)`,
    [user.id, organizationId, user.email, label],
  );
  return user;
}
