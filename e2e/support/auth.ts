import type { BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

/**
 * Signs a Playwright browser context in as a given user, without ever
 * touching the actual login UI -- there is no password to type (owner
 * decision D4), and no test inbox to click a real magic-link email from.
 *
 * Mints a magic link via the Admin API (service role, same mechanism
 * `requestMagicLink` uses), verifies it exactly the way `/auth/callback`
 * does, and injects the resulting session as the cookie `@supabase/ssr`
 * expects -- so proxy.ts and every server component that calls
 * `getCurrentUser()` see a completely ordinary authenticated request.
 */
export async function signInAs(context: BrowserContext, email: string): Promise<void> {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkError !== null) throw linkError;

  const captured: { name: string; value: string }[] = [];
  const anon = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) captured.push({ name, value });
      },
    },
  });

  const { error: verifyError } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });
  if (verifyError !== null) throw verifyError;

  // Every captured cookie, not just the first: a large session gets
  // chunked by @supabase/ssr into `sb-<ref>-auth-token.0`, `.1`, etc, and
  // dropping the later chunks would leave an unparseable partial session.
  const { hostname, protocol } = new URL(siteUrl);
  await context.addCookies(
    captured.map(({ name, value }) => ({
      name,
      value,
      domain: hostname,
      path: '/',
      secure: protocol === 'https:',
      sameSite: 'Lax' as const,
    })),
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${name} for the e2e suite. Check .env.local (or CI's env).`);
  }
  return value;
}
