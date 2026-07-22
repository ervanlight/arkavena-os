/**
 * Domain types for the Quality Gate (ARCHITECTURE.md 4.4). Pure data only --
 * no supabase/react/next, enforced by ESLint under domain/.
 *
 * `CashGateStatus` is a literal union duplicated from
 * modules/cash-gate/domain/types.ts's own definition, not imported from it --
 * domain/ may only import core/money, core/errors, lib (CLAUDE.md 1.2); a
 * cross-module domain import is exactly what that boundary forbids. This is
 * the same "duplication is deliberate" discipline ARCHITECTURE.md 0.2 already
 * applies to the SQL mirror of the Cash Gate/Variation domain logic -- a
 * db test can assert the two never drift, the way funding-coverage.ts's own
 * comments already point at for its SQL counterpart.
 */
export type CashGateStatus = 'green' | 'yellow' | 'red' | 'overdue';

export type WorkPackageState = {
  readonly id: string;
  readonly name: string;
};

/** One hold point template's status against a specific work package. */
export type HoldPointState = {
  readonly templateId: string;
  readonly templateName: string;
  readonly required: boolean;
  readonly passed: boolean;
  readonly overridden: boolean;
};

export type Proceed = { readonly allowed: true };

/** Blocked always carries the full list of reasons, never just a boolean (ARCHITECTURE.md 4.4). */
export type Blocked = { readonly reasons: readonly string[] };
