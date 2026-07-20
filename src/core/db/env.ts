/**
 * Environment access, in one place and validated once.
 *
 * Reading `process.env.X!` at the point of use means a missing variable becomes
 * a confusing runtime failure somewhere deep in a request. Failing here instead
 * means it fails at startup, with the name of the variable that is missing.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in; ` +
        'the local values are printed by `supabase start`.',
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL');
}

export function supabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * The service role key bypasses RLS entirely.
 *
 * Read through this function rather than directly, so there is a single place
 * to grep for every use of it -- and so the guard in admin.server.ts is the
 * only way in.
 */
export function supabaseServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY');
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
