import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/core/db/database.types';
import { supabaseAnonKey, supabaseUrl } from '@/core/db/env';

/**
 * Refreshes the Supabase session cookie on every request and gates
 * unauthenticated access.
 *
 * Named `proxy.ts`, not `middleware.ts` -- Next.js 16 renamed the convention
 * (the old file still works but logs a deprecation warning on every dev
 * server start, and the exported function must be named `proxy` to match).
 *
 * This has to run here, not in a layout. A Supabase auth token expires in an
 * hour; without this, a server component reading a stale cookie would see the
 * user as signed out mid-session, which looks like a random logout bug rather
 * than what it actually is.
 *
 * Route protection here is convenience, not the security boundary --
 * ARCHITECTURE.md 0.2 puts that in RLS. This exists so an unauthenticated
 * visitor lands on /login instead of a page that renders empty because every
 * query returned nothing.
 */

const PUBLIC_PATHS = ['/login', '/auth/callback', '/forgot-password', '/reset-password'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Calling getUser (not getSession) is what actually validates the token
  // against Supabase and triggers the refresh; reading the session alone
  // would just echo back a cookie that might already be expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, Next internals, and the PWA files
    // (manifest, service worker, offline fallback, icons) -- found while
    // building Fase 4's PWA setup: these were being redirected to /login
    // for a signed-out visitor, which breaks installability checks and the
    // one case offline.html exists for (a session that's expired or never
    // existed, shown the offline page instead of a login bounce).
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|offline\\.html|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png).*)',
  ],
};
