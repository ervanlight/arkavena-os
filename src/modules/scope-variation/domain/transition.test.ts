import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@/core/errors/result';
import { transition } from './transition';
import type { ChangeOrderEvent, ChangeOrderStatus, TransitionContext } from './types';

/**
 * ARCHITECTURE.md 4.5's Definition of Done for Variation, verbatim: "SEMUA
 * transisi legal + tabel lengkap transisi ilegal (loop semua status × semua
 * event, assert yang tidak ada di map -> error); guard approver salah role;
 * funded tanpa funding_receipt -> error." Each becomes its own describe
 * block below.
 *
 * One adaptation, noted rather than silently made: ADR 0012 (owner-approved)
 * made funding_received a manual Finance/Owner action with no link to a
 * funding_receipts row at all -- there is no "funding_receipt" entity this
 * domain can check for. The equivalent, actually-testable guarantee is that
 * `funding_received` cannot fire from anywhere except `approved_unpaid` --
 * covered by the full illegal-transition matrix below, which is what "funded
 * tanpa funding_receipt" becomes once ADR 0012's manual-trigger design is
 * substituted for the auto-linked one ARCHITECTURE.md 4.5 seems to assume.
 */

const ALL_STATUSES: readonly ChangeOrderStatus[] = [
  'draft',
  'under_review',
  'awaiting_client_approval',
  'approved_unpaid',
  'approved_funded',
  'rejected',
  'completed',
];

const ALL_EVENTS: readonly ChangeOrderEvent[] = [
  'submit_review',
  'send_to_client',
  'reject',
  'client_approve',
  'client_reject',
  'funding_received',
  'complete',
];

const LEGAL_EDGES = new Set<string>([
  'draft:submit_review',
  'under_review:send_to_client',
  'under_review:reject',
  'awaiting_client_approval:client_approve',
  'awaiting_client_approval:client_reject',
  'approved_unpaid:funding_received',
  'approved_funded:complete',
]);

const FULLY_PERMISSIVE: TransitionContext = {
  actorRole: 'owner',
  hasCostImpact: true,
  hasScheduleImpact: true,
  reason: 'Alasan lengkap untuk pengujian.',
};

describe('transition -- all seven legal edges', () => {
  it('draft --submit_review--> under_review, any staff role, no reason needed', () => {
    const result = transition('draft', 'submit_review', { actorRole: 'qs', hasCostImpact: false, hasScheduleImpact: false });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('under_review');
  });

  it('under_review --send_to_client--> awaiting_client_approval, reviewer role, no reason needed', () => {
    const result = transition('under_review', 'send_to_client', {
      actorRole: 'technical_director',
      hasCostImpact: false,
      hasScheduleImpact: false,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('awaiting_client_approval');
  });

  it('under_review --reject--> rejected, reviewer role, reason required', () => {
    const result = transition('under_review', 'reject', {
      actorRole: 'owner',
      hasCostImpact: false,
      hasScheduleImpact: false,
      reason: 'Estimasi tidak masuk akal.',
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('rejected');
  });

  it('awaiting_client_approval --client_approve--> approved_unpaid, client_approver only, impact + reason required', () => {
    const result = transition('awaiting_client_approval', 'client_approve', {
      actorRole: 'client_approver',
      hasCostImpact: true,
      hasScheduleImpact: true,
      reason: 'Setuju, silakan lanjutkan.',
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('approved_unpaid');
  });

  it('awaiting_client_approval --client_reject--> rejected, client_approver only, reason required', () => {
    const result = transition('awaiting_client_approval', 'client_reject', {
      actorRole: 'client_approver',
      hasCostImpact: true,
      hasScheduleImpact: true,
      reason: 'Terlalu mahal, tidak jadi.',
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('rejected');
  });

  it('approved_unpaid --funding_received--> approved_funded, owner/finance only, no reason needed', () => {
    const result = transition('approved_unpaid', 'funding_received', {
      actorRole: 'finance',
      hasCostImpact: true,
      hasScheduleImpact: true,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('approved_funded');
  });

  it('approved_funded --complete--> completed, staff (not finance), no reason needed', () => {
    const result = transition('approved_funded', 'complete', {
      actorRole: 'procurement',
      hasCostImpact: true,
      hasScheduleImpact: true,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('completed');
  });
});

describe('transition -- guard: wrong actor role for a role-gated event', () => {
  it('refuses submit_review from an external actor (no org_role)', () => {
    const result = transition('draft', 'submit_review', { actorRole: null, hasCostImpact: false, hasScheduleImpact: false });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('invalid_transition');
  });

  it('refuses submit_review from a client_approver', () => {
    const result = transition('draft', 'submit_review', {
      actorRole: 'client_approver',
      hasCostImpact: false,
      hasScheduleImpact: false,
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses send_to_client from finance (not a reviewer role)', () => {
    const result = transition('under_review', 'send_to_client', {
      actorRole: 'finance',
      hasCostImpact: false,
      hasScheduleImpact: false,
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses the staff reject from procurement (not a reviewer role)', () => {
    const result = transition('under_review', 'reject', {
      actorRole: 'procurement',
      hasCostImpact: false,
      hasScheduleImpact: false,
      reason: 'alasan',
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses client_approve from staff -- only the client_approver may decide', () => {
    const result = transition('awaiting_client_approval', 'client_approve', {
      actorRole: 'owner',
      hasCostImpact: true,
      hasScheduleImpact: true,
      reason: 'alasan',
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses client_reject from a project role other than client_approver', () => {
    const result = transition('awaiting_client_approval', 'client_reject', {
      actorRole: 'mandor',
      hasCostImpact: true,
      hasScheduleImpact: true,
      reason: 'alasan',
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses funding_received from qs (not owner/finance)', () => {
    const result = transition('approved_unpaid', 'funding_received', {
      actorRole: 'qs',
      hasCostImpact: true,
      hasScheduleImpact: true,
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses complete from finance -- finishing physical work is not a money decision', () => {
    const result = transition('approved_funded', 'complete', {
      actorRole: 'finance',
      hasCostImpact: true,
      hasScheduleImpact: true,
    });
    expect(isErr(result)).toBe(true);
  });
});

describe('transition -- guard: client_approve requires both cost and schedule impact filled in', () => {
  it('refuses when cost impact is missing', () => {
    const result = transition('awaiting_client_approval', 'client_approve', {
      actorRole: 'client_approver',
      hasCostImpact: false,
      hasScheduleImpact: true,
      reason: 'alasan',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('invalid_transition');
  });

  it('refuses when schedule impact is missing', () => {
    const result = transition('awaiting_client_approval', 'client_approve', {
      actorRole: 'client_approver',
      hasCostImpact: true,
      hasScheduleImpact: false,
      reason: 'alasan',
    });
    expect(isErr(result)).toBe(true);
  });

  it('refuses when both are missing', () => {
    const result = transition('awaiting_client_approval', 'client_approve', {
      actorRole: 'client_approver',
      hasCostImpact: false,
      hasScheduleImpact: false,
      reason: 'alasan',
    });
    expect(isErr(result)).toBe(true);
  });

  it('does not apply the impact guard to client_reject -- a client may reject without ever seeing a filled-in estimate', () => {
    const result = transition('awaiting_client_approval', 'client_reject', {
      actorRole: 'client_approver',
      hasCostImpact: false,
      hasScheduleImpact: false,
      reason: 'Tidak jadi, batalkan saja.',
    });
    expect(isOk(result)).toBe(true);
  });
});

describe('transition -- guard: reason required for reject, client_reject, client_approve', () => {
  it('refuses the staff reject with an empty reason', () => {
    const result = transition('under_review', 'reject', { actorRole: 'owner', hasCostImpact: false, hasScheduleImpact: false, reason: '' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('missing_reason');
  });

  it('refuses the staff reject with a whitespace-only reason', () => {
    const result = transition('under_review', 'reject', {
      actorRole: 'owner',
      hasCostImpact: false,
      hasScheduleImpact: false,
      reason: '   ',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('missing_reason');
  });

  it('refuses client_reject with no reason at all', () => {
    const result = transition('awaiting_client_approval', 'client_reject', {
      actorRole: 'client_approver',
      hasCostImpact: true,
      hasScheduleImpact: true,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('missing_reason');
  });

  it('refuses client_approve with no reason even when impact is filled in', () => {
    const result = transition('awaiting_client_approval', 'client_approve', {
      actorRole: 'client_approver',
      hasCostImpact: true,
      hasScheduleImpact: true,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('missing_reason');
  });

  it('does not require a reason for submit_review, send_to_client, funding_received, or complete', () => {
    expect(isOk(transition('draft', 'submit_review', { actorRole: 'owner', hasCostImpact: false, hasScheduleImpact: false }))).toBe(
      true,
    );
    expect(
      isOk(transition('under_review', 'send_to_client', { actorRole: 'owner', hasCostImpact: false, hasScheduleImpact: false })),
    ).toBe(true);
    expect(
      isOk(transition('approved_unpaid', 'funding_received', { actorRole: 'finance', hasCostImpact: true, hasScheduleImpact: true })),
    ).toBe(true);
    expect(isOk(transition('approved_funded', 'complete', { actorRole: 'owner', hasCostImpact: true, hasScheduleImpact: true }))).toBe(
      true,
    );
  });
});

describe('transition -- illegal transitions: full status x event matrix (loop semua status x semua event)', () => {
  for (const status of ALL_STATUSES) {
    for (const event of ALL_EVENTS) {
      const key = `${status}:${event}`;
      if (LEGAL_EDGES.has(key)) continue;

      it(`rejects "${event}" from status "${status}"`, () => {
        const result = transition(status, event, FULLY_PERMISSIVE);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.kind).toBe('invalid_transition');
      });
    }
  }

  it('covers exactly the 42 illegal combinations (49 total minus the 7 legal edges)', () => {
    const total = ALL_STATUSES.length * ALL_EVENTS.length;
    expect(total).toBe(49);
    expect(LEGAL_EDGES.size).toBe(7);
  });

  it('rejected and completed are terminal -- every event fails from both', () => {
    for (const event of ALL_EVENTS) {
      expect(isErr(transition('rejected', event, FULLY_PERMISSIVE))).toBe(true);
      expect(isErr(transition('completed', event, FULLY_PERMISSIVE))).toBe(true);
    }
  });
});
