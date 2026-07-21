import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionContext } from '@/core/permissions/guard';

/**
 * Regression test for ADR 0013: before it, `listWorkPackagesForProjectAction`
 * -- an ordinary Fase 1 read with no money in it, RLS-scoped by
 * fn_has_project_role() same as `projects`/`zones` -- threw PermissionError
 * for every project-role-only caller (mandor, site_coordinator, ...) before
 * the request ever reached Postgres, because ActionContext.orgRole is always
 * null for them and roleCan(null, ...) denied unconditionally regardless of
 * work_package.view listing PROJECT_ROLES.
 *
 * This calls the real exported action -- not a reimplementation of its
 * permission check -- through `safeAction`, `requirePermission`, and the real
 * `work-packages-repository` query shape. Only the two seams that need a live
 * Next.js request (`getActionContext`'s cookie read, and the Supabase client
 * `createServerSupabase` builds from those cookies) are stubbed; RLS itself
 * is proven separately, against real Postgres, in
 * supabase/tests/fase1-rls.test.ts and supabase/tests/permission-kernel.test.ts.
 */

const mandorContext: ActionContext = {
  userId: 'mandor-1',
  organizationId: 'org-1',
  orgRole: null,
  requestId: 'req-1',
};

function fakeSupabaseReturning(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.from = vi.fn(chain);
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  return builder;
}

vi.mock('@/core/auth/session', () => ({
  getActionContext: vi.fn(),
}));

vi.mock('@/core/db/client.server', () => ({
  createServerSupabase: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('listWorkPackagesForProjectAction, called as a mandor (ADR 0013)', () => {
  it('no longer refuses a project-role-only caller before the query runs', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    vi.mocked(getActionContext).mockResolvedValue(mandorContext);

    const projectId = '56077f6c-10e4-409e-8060-e15f7c2907db';
    const projectRow = {
      id: '498c4a72-cdac-4f68-87f7-95152c8dc351',
      project_id: projectId,
      organization_id: 'org-1',
      name: 'Pekerjaan pondasi',
      status: 'not_started',
      zone_id: null,
      milestone_id: null,
      deleted_at: null,
    };
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabaseReturning([projectRow]) as never);

    const { listWorkPackagesForProjectAction } = await import('./work-package-actions');
    const result = await listWorkPackagesForProjectAction(projectId);

    // Before ADR 0013 this was { ok: false, error: { code: 'PERMISSION_DENIED' } }
    // -- requirePermission threw inside safeAction and the handler, the
    // repository call, and the Supabase mock above were never reached.
    expect(result).toEqual({ ok: true, data: [projectRow] });
  });

  it('still refuses the same caller on a staff-only resource, e.g. milestones', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    vi.mocked(getActionContext).mockResolvedValue(mandorContext);
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabaseReturning([]) as never);

    const { listMilestonesForContractAction } = await import('./milestone-actions');
    const result = await listMilestonesForContractAction('fcebad53-79dd-4ad5-b2d4-d83893f1e80b');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PERMISSION_DENIED');
  });
});
