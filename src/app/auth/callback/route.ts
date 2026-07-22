import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/core/db/client.server';
import { getCurrentUser } from '@/core/auth/session';
import { decideDefaultLanding } from '@/core/auth/default-landing';
import { getMyProjectRolesAction } from '@/modules/projects';
import { logger } from '@/core/logging/logger';

/**
 * The magic link lands here. Supabase's email template points at this route
 * with a `code` query parameter; exchanging it is what actually creates the
 * session cookies -- until this runs, the link has proven the person controls
 * that inbox, but no session exists yet.
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

  const next = explicitNext ?? (await resolveDefaultLanding());

  // A relative path only. Trusting a redirect target that came from a query
  // string would turn this endpoint into an open redirector.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/cc';
  return NextResponse.redirect(new URL(safeNext, request.url));
}

/**
 * Gathers the two facts the redirect depends on (org role, project roles)
 * and hands them to `decideDefaultLanding` -- kept separate from that pure
 * function specifically so the branching itself has a Vitest-level unit
 * test that needs no request context.
 */
async function resolveDefaultLanding(): Promise<string> {
  const user = await getCurrentUser();
  if (user === null) return '/cc';

  const roles = await getMyProjectRolesAction(undefined);
  return decideDefaultLanding(user.orgRole, roles.ok ? roles.data : []);
}
