import type { Enums } from '@/core/db/database.types';
import type { Role } from '@/core/permissions/matrix';

const FIELD_PROJECT_ROLES: ReadonlySet<Enums<'project_role'>> = new Set(['site_coordinator', 'mandor']);
const CLIENT_PROJECT_ROLES: ReadonlySet<Enums<'project_role'>> = new Set(['client_approver', 'client_viewer']);
const PARTNER_PROJECT_ROLES: ReadonlySet<Enums<'project_role'>> = new Set(['supplier', 'subcontractor']);

/**
 * Where a bare magic link (no `next`, e.g. a mandor re-opening the app from
 * a bookmark or the installed icon rather than a fresh WhatsApp link) should
 * land. Staff with an org_role keep the existing /cc default. A signed-in
 * user with no org_role (every project-role-only person -- owner decision D4
 * means field roles sign in the identical way) would otherwise hit /cc and
 * see nothing but permission errors, since /cc's own pages all require staff
 * permissions; site_coordinator/mandor land in SiteFlow instead.
 *
 * client_approver/client_viewer land in the Client Timeline (`/portal`, ADR
 * 0026 §4.1) and supplier/subcontractor in Partner Desk (`/partner`) -- both
 * routes already handle "which project" themselves (redirect straight
 * through for exactly one project, otherwise show a picker), so this
 * function only needs to pick the right area. Before F5 shipped a real
 * landing page for clients, every one of these four roles fell through to
 * /cc and relied on always arriving via an explicit `next` (e.g.
 * /variations/[id]/approve); that fallback is now unreachable for them and
 * stays only for a genuinely roleless signed-in user.
 *
 * A plain, dependency-free function on purpose: /auth/callback's own
 * `resolveDefaultLanding` needs a real request/session to gather orgRole and
 * projectRoles, which cannot run under Vitest -- this is the branching those
 * two facts actually decide, split out so it can be unit-tested directly.
 */
export function decideDefaultLanding(orgRole: Role | null, projectRoles: readonly Enums<'project_role'>[]): string {
  if (orgRole !== null) return '/cc';
  if (projectRoles.some((role) => FIELD_PROJECT_ROLES.has(role))) return '/site';
  if (projectRoles.some((role) => CLIENT_PROJECT_ROLES.has(role))) return '/portal';
  if (projectRoles.some((role) => PARTNER_PROJECT_ROLES.has(role))) return '/partner';
  return '/cc';
}
