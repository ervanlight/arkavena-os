import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_MESSAGES_ID } from './codes';
import { DomainRuleError, ValidationError } from './app-error';
import { asAppError, toActionResult } from './handle';

/**
 * Regression coverage for a real bug caught by e2e/quality-gate.spec.ts: a
 * hand-authored `raise exception ... using errcode = 'check_violation'` (e.g.
 * fn_work_packages_guard_hold_point, ADR 0014) was collapsing to InfraError's
 * generic "system unavailable" text, silently discarding the specific
 * Indonesian message every such trigger across this codebase deliberately
 * writes for the user to read (CLAUDE.md 5). Affected every module with a
 * check_violation guard, not just quality-gate -- cash-gate and
 * scope-variation's work-package/change-order triggers use the exact same
 * pattern.
 */
/**
 * The shape asAppError actually receives in production: `@supabase/
 * supabase-js`'s default, non-`.throwOnError()` query path returns `error`
 * as a plain `JSON.parse`'d object (postgrest-js's `PostgrestBuilder.
 * _parseResponse` only wraps it in the `PostgrestError` class -- which does
 * extend `Error` -- on the opt-in throwing path this codebase never uses).
 * An earlier version of this fixture built an `Error` instance instead
 * (`Object.assign(new Error(...), props)`), which let a real bug in
 * asAppError's message extraction pass here while still producing
 * "[object Object]" in production, caught only by running
 * e2e/quality-gate.spec.ts and cash-gate.spec.ts against a real browser.
 * Module-scoped because the audience suite below builds the same shape.
 */
function postgrestError(props: { code: string; message: string; hint: string | null; details?: string | null }) {
  return { ...props };
}

describe('asAppError -- Postgres check_violation mapping', () => {
  it('surfaces a hinted business-rule message verbatim (our own raise exception)', () => {
    const pgError = postgrestError({
      code: '23514',
      message: 'Hold point belum lulus: 1 pemeriksaan wajib untuk jenis pekerjaan "waterproofing" belum disetujui',
      hint: 'ARCHITECTURE.md 4.4, ADR 0014.',
      details: null,
    });

    const appError = asAppError(pgError);

    expect(appError.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(appError.displayMessage).toBe(pgError.message);
  });

  it('keeps a genuine, un-hinted CHECK constraint violation generic (no hint set by Postgres itself)', () => {
    const pgError = postgrestError({
      code: '23514',
      message: 'new row for relation "organizations" violates check constraint "ck_organizations_name_not_blank"',
      hint: null,
      details: 'Failing row contains (some-uuid, , some-slug, active, ...).',
    });

    const appError = asAppError(pgError);

    expect(appError.code).toBe(ERROR_CODES.INFRA_UNAVAILABLE);
    expect(appError.displayMessage).not.toContain('ck_organizations_name_not_blank');
    expect(appError.displayMessage).not.toContain('Failing row contains');
  });

  it('surfaces a P0001 raise_exception (default errcode) the same way when hinted', () => {
    const pgError = postgrestError({
      code: 'P0001',
      message: 'Cash Gate red: pekerjaan tidak bisa dibuka sampai kas mencukupi',
      hint: 'ARCHITECTURE.md 4.2, ADR 0010.',
    });

    const appError = asAppError(pgError);

    expect(appError.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(appError.displayMessage).toBe(pgError.message);
  });

  it('still maps a permission-denied RLS refusal to PermissionError, unaffected by this change', () => {
    const pgError = postgrestError({ code: '42501', message: 'new row violates row-level security policy', hint: null });

    const appError = asAppError(pgError);

    expect(appError.code).toBe(ERROR_CODES.PERMISSION_DENIED);
  });
});

/**
 * ADR 0015 follow-up (PRE-LAUNCH-CHECKLIST item 1): the messages the branch
 * above deliberately preserves are written for staff readers. An external
 * caller (client-portal, partner-desk) must never see them -- same code,
 * catalogue text instead.
 */
describe('toActionResult -- external audience masks staff-facing text', () => {
  const hintedTriggerError = () =>
    asAppError(
      postgrestError({
        code: 'P0001',
        message: 'Cash Gate red: pekerjaan tidak bisa dibuka sampai kas mencukupi',
        hint: 'ARCHITECTURE.md 4.2, ADR 0010.',
      }),
    );

  it('staff audience still sees the trigger message verbatim (unchanged behaviour)', () => {
    const result = toActionResult(hintedTriggerError(), { audience: 'staff' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Cash Gate');
  });

  it('external audience gets the catalogue text for the same code, never the trigger message', () => {
    const result = toActionResult(hintedTriggerError(), { audience: 'external' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(result.error.message).toBe(ERROR_MESSAGES_ID[ERROR_CODES.VALIDATION_FAILED]);
    expect(result.error.message).not.toContain('Cash Gate');
  });

  it('external audience masks DomainRuleError wording (transition guard text is staff vocabulary)', () => {
    const error = new DomainRuleError(
      ERROR_CODES.VARIATION_INVALID_TRANSITION,
      'client_approve tidak valid dari status approved_funded',
      { userMessage: 'client_approve tidak valid dari status approved_funded' },
    );

    const result = toActionResult(error, { audience: 'external' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ERROR_CODES.VARIATION_INVALID_TRANSITION);
    expect(result.error.message).toBe(ERROR_MESSAGES_ID[ERROR_CODES.VARIATION_INVALID_TRANSITION]);
  });

  it('external audience keeps field-level input validation text -- it comes from our own schemas', () => {
    const error = new ValidationError('Alasan wajib diisi', { field: 'reason', userMessage: 'Alasan wajib diisi' });

    const result = toActionResult(error, { audience: 'external' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe('reason');
    expect(result.error.message).toBe('Alasan wajib diisi');
  });

  it('external audience drops blockedReasons entirely', () => {
    const error = new DomainRuleError(ERROR_CODES.VARIATION_NOT_FUNDED, 'terkunci', {
      userMessage: 'terkunci',
      blockedReasons: ['Inspeksi waterproofing belum lulus (hold point ADR 0014)'],
    });

    const result = toActionResult(error, { audience: 'external' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.blockedReasons).toBeUndefined();
  });

  it('omitting the option behaves as staff (no behaviour change for the other ~90 actions)', () => {
    const result = toActionResult(hintedTriggerError());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Cash Gate');
  });
});
