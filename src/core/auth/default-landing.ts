import type { Enums } from '@/core/db/database.types';
import type { Role } from '@/core/permissions/matrix';

const FIELD_PROJECT_ROLES: ReadonlySet<Enums<'project_role'>> = new Set(['site_coordinator', 'mandor']);

/**
 * Where a bare magic link (no `next`, e.g. a mandor re-opening the app from
 * a bookmark or the installed icon rather than a fresh WhatsApp link) should
 * land. Staff with an org_role keep the existing /cc default. A signed-in
 * user with no org_role (every project-role-only person -- owner decision D4
 * means field roles sign in the identical way) would otherwise hit /cc and
 * see nothing but permission errors, since /cc's own pages all require staff
 * permissions; site_coordinator/mandor land in SiteFlow instead.
 *
 * client_approver/client_viewer/supplier/subcontractor still have no generic
 * landing page of their own (Fase 6/8 build those) -- they always arrive via
 * an explicit `next` pointing at a specific secure-link page (e.g.
 * /variations/[id]/approve), so they never actually reach this fallback.
 *
 * A plain, dependency-free function on purpose: /auth/callback's own
 * `resolveDefaultLanding` needs a real request/session to gather orgRole and
 * projectRoles, which cannot run under Vitest -- this is the branching those
 * two facts actually decide, split out so it can be unit-tested directly.
 */
export function decideDefaultLanding(orgRole: Role | null, projectRoles: readonly Enums<'project_role'>[]): string {
  if (orgRole !== null) return '/cc';
  if (projectRoles.some((role) => FIELD_PROJECT_ROLES.has(role))) return '/site';
  return '/cc';
}
