import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/core/db/client.server';
import { logger } from '@/core/logging/logger';

/**
 * The magic link lands here. Supabase's email template points at this route
 * with a `code` query parameter; exchanging it is what actually creates the
 * session cookies -- until this runs, the link has proven the person controls
 * that inbox, but no session exists yet.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') ?? '/cc';

  if (code === null) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    logger.warn('auth.callback.failed', { message: error.message });
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url));
  }

  // A relative path only. Trusting a redirect target that came from a query
  // string would turn this endpoint into an open redirector.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/cc';
  return NextResponse.redirect(new URL(safeNext, request.url));
}
