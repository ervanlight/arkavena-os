import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionContext } from '@/core/permissions/guard';

/**
 * The explicit test ARCHITECTURE.md §7's Fase 10 exit criterion asks for:
 * "tidak ada jalur AI yang meng-approve pembayaran/kualitas/variation/status
 * keselamatan (dites eksplisit)". For this increment's two features that
 * means, concretely: neither action's Supabase client is ever asked to touch
 * any table other than `ai_generations` -- not `issues`, not `milestones`,
 * nothing. Same "stub only the two seams that need a live Next.js request"
 * pattern as work-package-actions.test.ts (ADR 0013); RLS on ai_generations
 * itself is proven separately, against real Postgres, in
 * supabase/tests/ai-scribe.test.ts.
 */

const ownerContext: ActionContext = {
  userId: 'owner-1',
  organizationId: 'org-1',
  orgRole: 'owner',
  requestId: 'req-1',
};

/** Tracks every table name passed to `.from()` -- the thing this file exists to assert on. */
function fakeSupabase(touchedTables: string[], sumResult: { cost_amount: number }[] = []) {
  const insertedRow = {
    id: 'gen-1',
    organization_id: 'org-1',
    project_id: null,
    feature: 'issue_classification',
    model: 'claude-haiku-4-5',
    input_tokens: 10,
    output_tokens: 20,
    cost_amount: 5,
    requested_by: 'owner-1',
    created_at: '2026-07-23T00:00:00.000Z',
  };

  const builder: Record<string, unknown> = {};
  builder.from = vi.fn((table: string) => {
    touchedTables.push(table);
    return builder;
  });
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => Promise.resolve({ data: sumResult, error: null }));
  builder.insert = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve({ data: insertedRow, error: null }));
  return builder;
}

vi.mock('@/core/auth/session', () => ({
  getActionContext: vi.fn(),
}));

vi.mock('@/core/db/client.server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('../data/claude-client', () => ({
  completeWithClaude: vi.fn(),
}));

vi.mock('@/modules/projects', () => ({
  listContractsForProjectAction: vi.fn(),
  listMilestonesForContractAction: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  // vi.restoreAllMocks() only restores vi.spyOn spies; the vi.mock()
  // factories above create plain vi.fn()s whose call history and
  // mockResolvedValue survive across tests unless explicitly cleared --
  // several tests below assert .not.toHaveBeenCalled(), which would
  // otherwise see a previous test's call.
  vi.clearAllMocks();
  vi.resetModules();
});

describe('generateIssueClassificationAction', () => {
  it('never touches any table but ai_generations, and returns a parsed suggestion', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabase(touchedTables) as never);
    vi.mocked(completeWithClaude).mockResolvedValue({
      text: 'severity: high\ncategory: keselamatan',
      model: 'claude-haiku-4-5',
      inputTokens: 50,
      outputTokens: 10,
      costAmount: 5n,
    });

    const { generateIssueClassificationAction } = await import('./issue-classification-actions');
    const result = await generateIssueClassificationAction({ title: 'Pekerja tidak pakai helm di zona 2' });

    expect(result).toEqual({
      ok: true,
      data: { suggestedSeverity: 'high', suggestedCategory: 'keselamatan' },
    });
    expect(new Set(touchedTables)).toEqual(new Set(['ai_generations']));
  });

  it('refuses to call Claude at all once the monthly budget cap is met', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeSupabase(touchedTables, [{ cost_amount: 300_000 }]) as never,
    );

    const { generateIssueClassificationAction } = await import('./issue-classification-actions');
    const result = await generateIssueClassificationAction({ title: 'AC bocor' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AI_BUDGET_EXCEEDED');
    expect(completeWithClaude).not.toHaveBeenCalled();
  });
});

describe('generateDelayDetectionAction', () => {
  it('never touches any table but ai_generations, and never calls Claude when nothing is overdue', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');
    const { listContractsForProjectAction, listMilestonesForContractAction } = await import('@/modules/projects');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabase(touchedTables) as never);
    vi.mocked(listContractsForProjectAction).mockResolvedValue({ ok: true, data: [{ id: 'contract-1' } as never] });
    vi.mocked(listMilestonesForContractAction).mockResolvedValue({
      ok: true,
      data: [{ id: 'm1', name: 'Termin 1', due_date: '2099-01-01', status: 'pending' } as never],
    });

    const { generateDelayDetectionAction } = await import('./delay-detection-actions');
    const result = await generateDelayDetectionAction({ projectId: '9d163ccb-c03c-458a-abd8-1cc158d6b332' });

    expect(result).toEqual({ ok: true, data: { overdueMilestones: [], draftSummary: null } });
    expect(completeWithClaude).not.toHaveBeenCalled();
    expect(touchedTables).toEqual([]);
  });

  it('narrates a real overdue milestone, still touching only ai_generations', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');
    const { listContractsForProjectAction, listMilestonesForContractAction } = await import('@/modules/projects');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabase(touchedTables) as never);
    vi.mocked(listContractsForProjectAction).mockResolvedValue({ ok: true, data: [{ id: 'contract-1' } as never] });
    vi.mocked(listMilestonesForContractAction).mockResolvedValue({
      ok: true,
      data: [{ id: 'm1', name: 'Termin 1', due_date: '2020-01-01', status: 'pending' } as never],
    });
    vi.mocked(completeWithClaude).mockResolvedValue({
      text: 'Termin 1 terlambat, perlu ditindaklanjuti segera.',
      model: 'claude-haiku-4-5',
      inputTokens: 30,
      outputTokens: 15,
      costAmount: 3n,
    });

    const { generateDelayDetectionAction } = await import('./delay-detection-actions');
    const result = await generateDelayDetectionAction({ projectId: '9d163ccb-c03c-458a-abd8-1cc158d6b332' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.overdueMilestones).toHaveLength(1);
      expect(result.data.overdueMilestones[0]!.id).toBe('m1');
      expect(result.data.draftSummary).toBe('Termin 1 terlambat, perlu ditindaklanjuti segera.');
    }
    expect(new Set(touchedTables)).toEqual(new Set(['ai_generations']));
  });
});
