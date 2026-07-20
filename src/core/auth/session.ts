import 'server-only';
import { cache } from 'react';
import { OrgContextError } from '@/core/errors/app-error';
import type { ActionContext } from '@/core/permissions/guard';
import type { Role } from '@/core/permissions/matrix';
import { newRequestId } from '@/core/logging/logger';
import { createServerSupabase } from '@/core/db/client.server';

/**
 * Session and organisation context (ARCHITECTURE.md 7, Fase 0 exit criteria).
 *
 * Sign-in is email magic link and nothing else (owner decision D4), for every
 * role including the field. There is no password path and no OTP provider
 * anywhere in this codebase.
 */

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  organizationName: string;
  orgRole: Role | null;
  status: 'invited' | 'active' | 'suspended';
};

/**
 * The signed-in user and their organisation, or null.
 *
 * Wrapped in React's `cache` so several server components in one render share
 * a single query rather than each issuing their own.
 *
 * Two things it does deliberately:
 *
 * It reads through the RLS-bound server client, so a user could not read
 * another organisation's profile row even if this query were wrong. The
 * organisation is not something the caller asserts; it is what the database
 * says.
 *
 * It returns null for a suspended or soft-deleted user, matching
 * fn_current_org_id() exactly. If these two disagreed, the application would
 * show a page the database then refuses to fill -- the confusing failure where
 * everything looks signed in but nothing loads.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, organization_id, org_role, status, organizations(name)')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null || data === null) return null;
  if (data.status === 'suspended') return null;

  const organization = data.organizations;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    organizationId: data.organization_id,
    organizationName: organization?.name ?? '',
    orgRole: data.org_role,
    status: data.status,
  };
});

/**
 * Build the context every server action runs with.
 *
 * A signed-in user with no organisation is an error rather than a null: the
 * account exists but is unusable, and the person needs an administrator, not
 * another sign-in attempt. ORG_CONTEXT_MISSING says exactly that.
 */
export async function getActionContext(): Promise<ActionContext | null> {
  const user = await getCurrentUser();
  if (user === null) return null;

  if (user.organizationId === '') {
    throw new OrgContextError('Signed-in user has no organisation', { meta: { userId: user.id } });
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    orgRole: user.orgRole,
    requestId: newRequestId(),
  };
}

/** True when someone is signed in with a usable organisation. */
export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}
