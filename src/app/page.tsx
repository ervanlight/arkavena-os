import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { decideDefaultLanding } from '@/core/auth/default-landing';
import { getMyProjectRolesAction } from '@/modules/projects';

/**
 * The one place that decides where a signed-in visitor with no explicit
 * destination lands (ADR 0025 SS4). Both the login form (on success) and
 * /auth/callback (when no `next` was carried through) redirect here rather
 * than duplicating the orgRole/project-roles lookup themselves.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user === null) redirect('/login');

  const roles = await getMyProjectRolesAction(undefined);
  redirect(decideDefaultLanding(user.orgRole, roles.ok ? roles.data : []) as Route);
}
