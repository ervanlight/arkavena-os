/**
 * Domain types for Billing's issuance gate (ARCHITECTURE.md 7, ADR 0017).
 * Pure data only -- no supabase/react/next, enforced by ESLint under domain/.
 */

export type MilestoneState = {
  readonly id: string;
  readonly status: 'pending' | 'completed';
};

/** One hold point template's status against one of the milestone's work packages -- same shape as quality-gate's own HoldPointState, duplicated rather than imported (domain/ may not import another module's domain, CLAUDE.md 1.2). */
export type HoldPointState = {
  readonly templateName: string;
  readonly passed: boolean;
  readonly overridden: boolean;
};

/** The linked variation's status, when an invoice bills variation work -- null when it doesn't. */
export type ChangeOrderState = { readonly status: string } | null;

export type Proceed = { readonly allowed: true };

/** Blocked always carries the full list of reasons, never just a boolean (same convention as Quality Hold Point, ARCHITECTURE.md 4.4/4.5). */
export type Blocked = { readonly reasons: readonly string[] };
