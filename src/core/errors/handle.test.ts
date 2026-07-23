import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from './codes';
import { asAppError } from './handle';

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
describe('asAppError -- Postgres check_violation mapping', () => {
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
   */
  function postgrestError(props: { code: string; message: string; hint: string | null; details?: string | null }) {
    return { ...props };
  }

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
