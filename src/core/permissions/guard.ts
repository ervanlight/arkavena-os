import { OrgContextError, PermissionError, UnauthenticatedError } from '@/core/errors/app-error';
import { roleCan, type ActionFor, type Resource, type Role } from './matrix';

/**
 * The request context every server action runs with.
 *
 * It is passed explicitly rather than read from a global. That keeps the guard
 * testable without a request, and makes it impossible for a function to be
 * accidentally permission-checked against the wrong user.
 */
export type ActionContext = {
  userId: string;
  organizationId: string;
  /** NULL for external users, who hold project roles instead (Wave 4). */
  orgRole: Role | null;
  requestId: string;
};

/**
 * Assert a permission, or throw (ARCHITECTURE.md 6.2, enforcer 2).
 *
 * This is not the security boundary -- RLS is. Its job is to fail early with an
 * error a person can act on, in the language they read, instead of letting the
 * request reach the database and come back as an empty result set that looks
 * like missing data.
 *
 * Because it is not the last line of defence, a bug here is a usability
 * problem rather than a breach. That is the reason RLS exists underneath, and
 * the reason the RLS tests are not optional.
 */
export function requirePermission<TResource extends Resource>(
  context: ActionContext | null,
  resource: TResource,
  action: ActionFor<TResource>,
): asserts context is ActionContext {
  if (context === null) {
    throw new UnauthenticatedError('No session for a permission-checked action', {
      meta: { resource, action },
    });
  }

  if (context.organizationId === '') {
    throw new OrgContextError('Session has no organisation context', {
      meta: { userId: context.userId, resource, action },
    });
  }

  if (!roleCan(context.orgRole, resource, action)) {
    throw new PermissionError(
      `Role ${context.orgRole ?? 'none'} may not ${String(action)} ${String(resource)}`,
      {
        meta: {
          userId: context.userId,
          organizationId: context.organizationId,
          requestId: context.requestId,
          resource,
          action,
          role: context.orgRole,
        },
      },
    );
  }
}

/** The non-throwing form, for branching. */
export function can<TResource extends Resource>(
  context: ActionContext | null,
  resource: TResource,
  action: ActionFor<TResource>,
): boolean {
  if (context === null || context.organizationId === '') return false;
  return roleCan(context.orgRole, resource, action);
}
