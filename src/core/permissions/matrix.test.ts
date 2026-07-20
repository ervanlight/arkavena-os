import { describe, expect, it } from 'vitest';
import { OrgContextError, PermissionError, UnauthenticatedError } from '@/core/errors/app-error';
import { can, requirePermission, type ActionContext } from './guard';
import { ALL_ROLES, ORG_ROLES, PERMISSIONS, PROJECT_ROLES, roleCan, rolesAllowedTo } from './matrix';

const context = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  userId: 'u1',
  organizationId: 'org1',
  orgRole: 'owner',
  requestId: 'req1',
  ...overrides,
});

describe('the matrix itself', () => {
  it('covers exactly the eleven roles from ARCHITECTURE.md 6.1', () => {
    expect(ORG_ROLES).toHaveLength(5);
    expect(PROJECT_ROLES).toHaveLength(6);
    expect(ALL_ROLES).toHaveLength(11);
    expect(new Set(ALL_ROLES).size).toBe(11);
  });

  it('never lists a role that is not one of the eleven', () => {
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      for (const [action, roles] of Object.entries(actions)) {
        for (const role of roles as readonly string[]) {
          expect(ALL_ROLES, `${resource}.${action} lists unknown role "${role}"`).toContain(role);
        }
      }
    }
  });

  it('never lists the same role twice for one action', () => {
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      for (const [action, roles] of Object.entries(actions)) {
        const list = roles as readonly string[];
        expect(new Set(list).size, `${resource}.${action} has a duplicate role`).toBe(list.length);
      }
    }
  });
});

describe('the permissions that matter most', () => {
  it('lets only the owner change a role', () => {
    // Anyone else being able to do this is privilege escalation, so it is
    // asserted here as well as blocked by trg_users_guard_privileged_columns.
    expect(rolesAllowedTo('user', 'change_role')).toEqual(['owner']);

    for (const role of ALL_ROLES) {
      expect(roleCan(role, 'user', 'change_role'), `${role} must not change roles`).toBe(role === 'owner');
    }
  });

  it('keeps every external role out of the audit trail', () => {
    const external = ['client_approver', 'client_viewer', 'supplier', 'subcontractor'] as const;

    for (const role of external) {
      expect(roleCan(role, 'audit_log', 'view'), `${role} must not read audit logs`).toBe(false);
    }
    for (const role of ORG_ROLES) {
      expect(roleCan(role, 'audit_log', 'view'), `${role} should read audit logs`).toBe(true);
    }
  });

  it('lets nobody manage roles through the application', () => {
    // Reference data changes by migration. An empty list is a decision, not an
    // oversight, so it is asserted.
    expect(rolesAllowedTo('role', 'manage')).toEqual([]);
    for (const role of ALL_ROLES) {
      expect(roleCan(role, 'role', 'manage')).toBe(false);
    }
  });

  it('denies everything to a user with no organisation role', () => {
    // External users hold project roles instead; those are checked separately
    // from Wave 4. Here they must get nothing by default.
    expect(roleCan(null, 'organization', 'view')).toBe(false);
    expect(roleCan(undefined, 'audit_log', 'view')).toBe(false);
  });

  it('denies an unknown action rather than defaulting to allow', () => {
    // @ts-expect-error -- 'demolish' is not an action on organization.
    expect(roleCan('owner', 'organization', 'demolish')).toBe(false);
  });
});

describe('requirePermission', () => {
  it('passes for an allowed role', () => {
    expect(() => requirePermission(context(), 'organization', 'update')).not.toThrow();
  });

  it('throws PermissionError for a disallowed role', () => {
    expect(() => requirePermission(context({ orgRole: 'finance' }), 'organization', 'update')).toThrow(
      PermissionError,
    );
  });

  it('throws UnauthenticatedError when there is no session', () => {
    expect(() => requirePermission(null, 'organization', 'view')).toThrow(UnauthenticatedError);
  });

  it('throws OrgContextError when the session has no organisation', () => {
    // Distinct from unauthenticated: signing in again will not fix it, so the
    // user needs a different message and an administrator.
    expect(() => requirePermission(context({ organizationId: '' }), 'organization', 'view')).toThrow(
      OrgContextError,
    );
  });

  it('does not put the user-facing message at risk of leaking internals', () => {
    try {
      requirePermission(context({ orgRole: 'mandor' }), 'audit_log', 'view');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionError);
      const permissionError = error as PermissionError;
      // The log message names the role and resource; the displayed one does not.
      expect(permissionError.message).toContain('mandor');
      expect(permissionError.displayMessage).toBe('Anda tidak memiliki akses untuk tindakan ini.');
      expect(permissionError.meta).toMatchObject({ userId: 'u1', organizationId: 'org1' });
    }
  });
});

describe('can', () => {
  it('mirrors requirePermission without throwing', () => {
    expect(can(context(), 'organization', 'update')).toBe(true);
    expect(can(context({ orgRole: 'qs' }), 'organization', 'update')).toBe(false);
    expect(can(null, 'organization', 'view')).toBe(false);
    expect(can(context({ organizationId: '' }), 'organization', 'view')).toBe(false);
  });
});
