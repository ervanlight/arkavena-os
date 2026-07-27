/**
 * Environment access, in one place and validated once.
 *
 * Reading `process.env.X!` at the point of use means a missing variable becomes
 * a confusing runtime failure somewhere deep in a request. Failing here instead
 * means it fails at startup, with the name of the variable that is missing.
 */

import { ValidationError } from '@/core/errors/app-error';

function required(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new ValidationError(`Missing environment variable ${name}`, {
      userMessage: `Konfigurasi server belum lengkap (variabel ${name} tidak ditemukan). Harap periksa environment variables di server.`,
    });
  }
  return value;
}

/**
 * `NEXT_PUBLIC_*` vars must appear as a literal `process.env.NEXT_PUBLIC_X`
 * expression for Next.js to inline them into the client bundle -- a browser
 * has no real `process.env` at runtime, so this replacement happens at build
 * time, and only for expressions its bundler can statically find. Routing
 * the name through a variable (`process.env[name]`) defeats that: it reads
 * fine on the server (a real, full process.env), but silently resolves to
 * undefined in any client bundle, no matter what name is passed. Found while
 * wiring the first client-side Supabase usage in this app (SiteFlow's photo
 * upload, straight from the browser to Storage) -- every server action
 * before this was server-only and never exposed the gap.
 */
export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * The service role key bypasses RLS entirely.
 *
 * Read through this function rather than directly, so there is a single place
 * to grep for every use of it -- and so the guard in admin.server.ts is the
 * only way in.
 */
export function supabaseServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * The localhost fallback exists for local dev only. In production a missing
 * NEXT_PUBLIC_SITE_URL must fail loudly: this value becomes the magic-link
 * redirect target, and the silent fallback meant a deploy that forgot the
 * variable sent every login email pointing at localhost -- no error anywhere,
 * users simply could not sign in (exactly what happened on the first Vercel
 * deploy, 2026-07-23). Supabase then quietly substituted its Site URL because
 * localhost was not in the redirect allow-list, which masked the bug further.
 */
export function siteUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL);
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
