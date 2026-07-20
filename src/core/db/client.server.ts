import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * The Supabase client for server components and server actions.
 *
 * It uses the anon key and the signed-in user's cookies, which means **RLS is
 * active on every query made through it**. That is the point: this client can
 * only ever see what the user is allowed to see, so a forgotten `where
 * organization_id = ...` in a repository is caught by the database rather than
 * leaking another tenant's rows.
 *
 * Use this everywhere. The service-role client in admin.server.ts is the
 * exception, and it exists for system jobs only.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. Session refresh happens in
          // middleware instead, so this is expected rather than a failure --
          // swallowing it here is why reads from a server component work.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
