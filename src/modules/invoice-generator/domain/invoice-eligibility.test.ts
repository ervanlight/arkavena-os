import { describe, expect, it } from 'vitest';
import { canIssueInvoice } from './invoice-eligibility';

const completedMilestone = { id: 'm1', status: 'completed' as const };
const pendingMilestone = { id: 'm1', status: 'pending' as const };
const passedHoldPoint = { templateName: 'Flood test', passed: true, overridden: false };
const failedHoldPoint = { templateName: 'Flood test', passed: false, overridden: false };
const overriddenHoldPoint = { templateName: 'Flood test', passed: false, overridden: true };

describe('canIssueInvoice', () => {
  it('allows issuance when every precondition holds and there is no linked variation', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [passedHoldPoint],
      changeOrder: null,
      approvedByTechnicalDirector: true,
    });
    expect(result).toEqual({ ok: true, value: { allowed: true } });
  });

  it('allows issuance with zero hold points at all (no QC requirement for this milestone)', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [],
      changeOrder: null,
      approvedByTechnicalDirector: true,
    });
    expect(result.ok).toBe(true);
  });

  it('allows issuance when a hold point failed but was overridden', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [overriddenHoldPoint],
      changeOrder: null,
      approvedByTechnicalDirector: true,
    });
    expect(result.ok).toBe(true);
  });

  it('blocks when the milestone is not completed', () => {
    const result = canIssueInvoice({
      milestone: pendingMilestone,
      holdPoints: [passedHoldPoint],
      changeOrder: null,
      approvedByTechnicalDirector: true,
    });
    expect(result).toEqual({
      ok: false,
      error: { reasons: ['Milestone belum selesai, invoice belum bisa terbit.'] },
    });
  });

  it('blocks with one reason per unmet hold point, not just the first', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [failedHoldPoint, { ...failedHoldPoint, templateName: 'Rebar spacing' }],
      changeOrder: null,
      approvedByTechnicalDirector: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reasons).toHaveLength(2);
      expect(result.error.reasons[0]).toContain('Flood test');
      expect(result.error.reasons[1]).toContain('Rebar spacing');
    }
  });

  it('blocks when a linked variation is not approved_funded', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [],
      changeOrder: { status: 'approved_unpaid' },
      approvedByTechnicalDirector: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reasons).toContain('Variation terkait belum approved_funded, invoice belum bisa terbit.');
    }
  });

  it('allows issuance when the linked variation is approved_funded', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [],
      changeOrder: { status: 'approved_funded' },
      approvedByTechnicalDirector: true,
    });
    expect(result.ok).toBe(true);
  });

  it('blocks when there is no Technical Director approval yet', () => {
    const result = canIssueInvoice({
      milestone: completedMilestone,
      holdPoints: [],
      changeOrder: null,
      approvedByTechnicalDirector: false,
    });
    expect(result).toEqual({
      ok: false,
      error: { reasons: ['Invoice wajib disetujui Technical Director sebelum terbit.'] },
    });
  });

  it('blocks with every unmet reason at once, not just the first found', () => {
    const result = canIssueInvoice({
      milestone: pendingMilestone,
      holdPoints: [failedHoldPoint],
      changeOrder: { status: 'draft' },
      approvedByTechnicalDirector: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reasons).toHaveLength(4);
    }
  });
});
