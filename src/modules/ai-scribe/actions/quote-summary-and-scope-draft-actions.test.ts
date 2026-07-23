import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionContext } from '@/core/permissions/guard';
import { toRupiah } from '@/core/money/rupiah';

/**
 * Same "never touches any table but ai_generations" assertion as
 * ai-scribe-actions.test.ts, for the two features added after that file --
 * quote_summary reads modules/procurement, assessment_scope_draft reads
 * modules/assessment, both only through each module's public API.
 */

const ownerContext: ActionContext = {
  userId: 'owner-1',
  organizationId: 'org-1',
  orgRole: 'owner',
  requestId: 'req-1',
};

function fakeSupabase(touchedTables: string[], sumResult: { cost_amount: number }[] = []) {
  const insertedRow = {
    id: 'gen-1',
    organization_id: 'org-1',
    project_id: 'project-1',
    feature: 'quote_summary',
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

vi.mock('@/modules/procurement', () => ({
  getVendorQuoteAction: vi.fn(),
  listVendorQuotesForProjectAction: vi.fn(),
  getVendorAction: vi.fn(),
}));

vi.mock('@/modules/assessment', () => ({
  getAssessmentAction: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('generateQuoteSummaryAction', () => {
  it('never touches any table but ai_generations, comparing sibling quotes sharing a material_request_id', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');
    const { getVendorQuoteAction, listVendorQuotesForProjectAction, getVendorAction } = await import(
      '@/modules/procurement'
    );

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabase(touchedTables) as never);

    const quote = {
      id: '634ac55d-c018-48e7-8e99-161ce96fad1d',
      project_id: 'project-1',
      vendor_id: 'vendor-1',
      material_request_id: 'mr-1',
      description: 'Semen 50 sak',
      amount: toRupiah(5_000_000),
    };
    const sibling = {
      id: '1d93a271-2b0a-4784-b89a-5345c4ad4ca0',
      project_id: 'project-1',
      vendor_id: 'vendor-2',
      material_request_id: 'mr-1',
      description: 'Semen 50 sak',
      amount: toRupiah(4_500_000),
    };

    vi.mocked(getVendorQuoteAction).mockResolvedValue({ ok: true, data: quote as never });
    vi.mocked(listVendorQuotesForProjectAction).mockResolvedValue({ ok: true, data: [quote, sibling] as never });
    vi.mocked(getVendorAction).mockImplementation(async (vendorId) => ({
      ok: true,
      data: { id: vendorId, name: vendorId === 'vendor-1' ? 'Vendor A' : 'Vendor B' } as never,
    }));
    vi.mocked(completeWithClaude).mockResolvedValue({
      text: 'Vendor B tampak lebih hemat untuk barang yang sama.',
      model: 'claude-haiku-4-5',
      inputTokens: 40,
      outputTokens: 20,
      costAmount: 4n,
    });

    const { generateQuoteSummaryAction } = await import('./quote-summary-actions');
    const result = await generateQuoteSummaryAction({ vendorQuoteId: quote.id });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.quotes).toHaveLength(2);
      expect(result.data.summary).toBe('Vendor B tampak lebih hemat untuk barang yang sama.');
    }
    expect(new Set(touchedTables)).toEqual(new Set(['ai_generations']));
  });

  it('refuses to call Claude once the monthly budget cap is met', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');
    const { getVendorQuoteAction, getVendorAction } = await import('@/modules/procurement');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeSupabase(touchedTables, [{ cost_amount: 300_000 }]) as never,
    );

    const quote = {
      id: '51d74ac4-17eb-4594-9654-61cb9df1bbcc',
      project_id: 'project-1',
      vendor_id: 'vendor-1',
      material_request_id: null,
      description: 'Pasir 1 truk',
      amount: toRupiah(1_000_000),
    };
    vi.mocked(getVendorQuoteAction).mockResolvedValue({ ok: true, data: quote as never });
    vi.mocked(getVendorAction).mockResolvedValue({ ok: true, data: { id: 'vendor-1', name: 'Vendor A' } as never });

    const { generateQuoteSummaryAction } = await import('./quote-summary-actions');
    const result = await generateQuoteSummaryAction({ vendorQuoteId: quote.id });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AI_BUDGET_EXCEEDED');
    expect(completeWithClaude).not.toHaveBeenCalled();
  });
});

describe('generateAssessmentScopeDraftAction', () => {
  it('never touches any table but ai_generations, drafting from site_conditions', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');
    const { getAssessmentAction } = await import('@/modules/assessment');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabase(touchedTables) as never);
    vi.mocked(getAssessmentAction).mockResolvedValue({
      ok: true,
      data: {
        id: 'f13bcc77-e11a-4ea5-b809-87dfa96bf9e1',
        project_id: 'project-1',
        site_conditions: 'Atap bocor di dua titik, rangka kayu lapuk sebagian.',
        recommended_scope: null,
      } as never,
    });
    vi.mocked(completeWithClaude).mockResolvedValue({
      text: 'Disarankan mengganti rangka kayu yang lapuk dan menutup ulang titik kebocoran atap.',
      model: 'claude-sonnet-5',
      inputTokens: 60,
      outputTokens: 30,
      costAmount: 8n,
    });

    const { generateAssessmentScopeDraftAction } = await import('./assessment-scope-draft-actions');
    const result = await generateAssessmentScopeDraftAction({ assessmentId: 'f13bcc77-e11a-4ea5-b809-87dfa96bf9e1' });

    expect(result).toEqual({
      ok: true,
      data: { suggestedScope: 'Disarankan mengganti rangka kayu yang lapuk dan menutup ulang titik kebocoran atap.' },
    });
    expect(new Set(touchedTables)).toEqual(new Set(['ai_generations']));
  });

  it('rejects with a domain error, never calling Claude, when site_conditions is empty', async () => {
    const { getActionContext } = await import('@/core/auth/session');
    const { createServerSupabase } = await import('@/core/db/client.server');
    const { completeWithClaude } = await import('../data/claude-client');
    const { getAssessmentAction } = await import('@/modules/assessment');

    vi.mocked(getActionContext).mockResolvedValue(ownerContext);
    const touchedTables: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(fakeSupabase(touchedTables) as never);
    vi.mocked(getAssessmentAction).mockResolvedValue({
      ok: true,
      data: { id: 'f13bcc77-e11a-4ea5-b809-87dfa96bf9e1', project_id: 'project-1', site_conditions: null, recommended_scope: null } as never,
    });

    const { generateAssessmentScopeDraftAction } = await import('./assessment-scope-draft-actions');
    const result = await generateAssessmentScopeDraftAction({ assessmentId: 'f13bcc77-e11a-4ea5-b809-87dfa96bf9e1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(completeWithClaude).not.toHaveBeenCalled();
    expect(touchedTables).toEqual([]);
  });
});
