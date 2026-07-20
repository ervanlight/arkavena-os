import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabaseServiceRoleKey, supabaseUrl } from './env';

/**
 * The service-role client. **It bypasses row level security completely.**
 *
 * Every other client in this codebase is bounded by what the signed-in user may
 * see. This one is not: it can read and write every row of every organisation.
 * That makes it the single most dangerous object in the repository, and the
 * reason it lives alone in a file with a name that says so.
 *
 * Legitimate uses, and there are few:
 *
 *   - provisioning a user, which must write a row before that user has a session
 *   - background jobs running with no user at all
 *   - migrations and maintenance scripts
 *
 * It must never be reached from a request handler acting on behalf of a user.
 * If a feature seems to need it there, the real problem is almost always a
 * missing policy -- and reaching for this client hides that problem instead of
 * fixing it, in the one layer ARCHITECTURE.md 0.2 calls the last fortress.
 *
 * `import 'server-only'` makes a build fail if this file is ever pulled into a
 * client bundle, so the key cannot reach a browser by accident.
 */
export function createAdminSupabase() {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AdminSupabase = ReturnType<typeof createAdminSupabase>;
