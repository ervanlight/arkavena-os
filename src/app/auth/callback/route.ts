import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/core/db/client.server';
import { logger } from '@/core/logging/logger';

/**
 * Password-recovery links land here (ADR 0025 SS3 -- sign-in itself no
 * longer uses this route now that magic link is gone; only
 * `requestPasswordReset`'s emailed link still does). Supabase's recovery
 * link verifies through the identical `code`-exchange mechanism a magic link
 * used, so this route needed no new logic when ADR 0025 landed, only this
 * comment update: exchanging the code is what actually creates the session
 * cookies -- until this runs, the link has proven the person controls that
 * inbox, but no session exists yet.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const explicitNext = request.nextUrl.searchParams.get('next');

  if (code === null) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    logger.warn('auth.callback.failed', { message: error.message });
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url));
  }

  const next = explicitNext ?? '/';

  // A relative path only. Trusting a redirect target that came from a query
  // string would turn this endpoint into an open redirector.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(new URL(safeNext, request.url));
}
