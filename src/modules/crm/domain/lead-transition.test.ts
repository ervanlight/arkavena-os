import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@/core/errors/result';
import { transition, type LeadStatus } from './lead-transition';

/**
 * Full legal + illegal transition matrix, same "loop every status x every
 * target, assert only the graph's own edges succeed" shape ARCHITECTURE.md
 * 4.5 asks of the Variation state machine (mirrored here for the lead
 * pipeline, ADR 0018 SS1) -- this is the domain-layer counterpart of
 * fn_leads_guard_transition (supabase/migrations/20260723010000_...).
 */

const ALL_STATUSES: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'assessment_scheduled',
  'proposal_sent',
  'won',
  'lost',
];

const LEGAL_FORWARD_EDGES: ReadonlyArray<[LeadStatus, LeadStatus]> = [
  ['new', 'contacted'],
  ['contacted', 'qualified'],
  ['qualified', 'assessment_scheduled'],
  ['assessment_scheduled', 'proposal_sent'],
  ['proposal_sent', 'won'],
];

const LOSABLE_FROM: readonly LeadStatus[] = ['new', 'contacted', 'qualified', 'assessment_scheduled', 'proposal_sent'];

describe('transition (lead pipeline)', () => {
  describe('legal forward edges', () => {
    for (const [current, next] of LEGAL_FORWARD_EDGES) {
      it(`allows ${current} -> ${next}`, () => {
        const result = transition(current, next, {});
        expect(isOk(result)).toBe(true);
        if (isOk(result)) expect(result.value).toBe(next);
      });
    }
  });

  describe('legal lost edges, with reason', () => {
    for (const current of LOSABLE_FROM) {
      it(`allows ${current} -> lost when a reason is given`, () => {
        const result = transition(current, 'lost', { lostReason: 'Klien memilih vendor lain' });
        expect(isOk(result)).toBe(true);
        if (isOk(result)) expect(result.value).toBe('lost');
      });
    }
  });

  describe('lost requires a non-blank reason', () => {
    it('rejects lost with no reason at all', () => {
      const result = transition('qualified', 'lost', {});
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.kind).toBe('missing_reason');
    });

    it('rejects lost with a blank/whitespace-only reason', () => {
      const result = transition('qualified', 'lost', { lostReason: '   ' });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.kind).toBe('missing_reason');
    });
  });

  describe('full illegal-transition matrix', () => {
    const legalPairs = new Set<string>([
      ...LEGAL_FORWARD_EDGES.map(([c, n]) => `${c}->${n}`),
      ...LOSABLE_FROM.map((c) => `${c}->lost`),
    ]);

    for (const current of ALL_STATUSES) {
      for (const next of ALL_STATUSES) {
        if (current === next) continue;
        const key = `${current}->${next}`;
        if (legalPairs.has(key)) continue;

        it(`rejects ${current} -> ${next}`, () => {
          const result = transition(current, next, { lostReason: 'alasan' });
          expect(isErr(result)).toBe(true);
          if (isErr(result)) expect(result.error.kind).toBe('invalid_transition');
        });
      }
    }
  });

  describe('terminal states', () => {
    it('won has no legal next status', () => {
      for (const next of ALL_STATUSES) {
        if (next === 'won') continue;
        const result = transition('won', next, { lostReason: 'alasan' });
        expect(isErr(result)).toBe(true);
      }
    });

    it('lost has no legal next status', () => {
      for (const next of ALL_STATUSES) {
        if (next === 'lost') continue;
        const result = transition('lost', next, { lostReason: 'alasan' });
        expect(isErr(result)).toBe(true);
      }
    });
  });
});
