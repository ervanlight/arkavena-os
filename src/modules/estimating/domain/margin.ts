import { addRp, mulRpQuantity, ratioBp, subRp, ZERO_RP, type BasisPoints, type Rupiah } from '@/core/money/rupiah';

/**
 * Margin (ARCHITECTURE.md 8, ADR 0018 SS4). Pure functions only: input plain
 * data, output a decision. No I/O, no ambient clock, no import of
 * supabase/react/next -- ESLint enforces all three under domain/.
 *
 * Unlike Cash Gate or the Variation state machine, "below floor" is a
 * warning banner in the UI, not a blocking trigger (ADR 0018 SS4's own
 * words: "memicu warning", not "menolak") -- so there is no database-side
 * mirror of this file the way fn_cash_gate_status or
 * fn_leads_guard_transition exist. This is one of the few money rules in
 * this codebase enforced only at the domain/UI layer, alongside Decision
 * Clock (Fase 6) and the aging tiers (Fase 7).
 */

export type EstimateLine = {
  readonly quantity: number;
  readonly unitCost: Rupiah;
  readonly unitPrice: Rupiah;
};

export type MarginResult = {
  readonly totalCost: Rupiah;
  readonly totalPrice: Rupiah;
  readonly marginAmount: Rupiah;
  /**
   * null specifically means "nothing was priced at all" (division by zero
   * in ratioBp, an empty or all-zero-price line set), not missing data --
   * same convention modules/cash-gate/domain/funding-coverage.ts's own
   * `ratioBp` field already established.
   */
  readonly marginBp: BasisPoints | null;
};

/**
 * Sums an estimate's line items into cost, price, margin amount, and margin
 * ratio. Line totals round each line toward the company's favour (`ceil` on
 * cost, `floor` on price) before summing -- an estimate is drafted before
 * the fact, so the safer direction for an internal number nobody else
 * checks line-by-line is to slightly overstate cost and understate price,
 * never the reverse.
 */
export function computeMargin(lines: readonly EstimateLine[]): MarginResult {
  let totalCost: Rupiah = ZERO_RP;
  let totalPrice: Rupiah = ZERO_RP;

  for (const line of lines) {
    totalCost = addRp(totalCost, mulRpQuantity(line.unitCost, line.quantity, 'ceil'));
    totalPrice = addRp(totalPrice, mulRpQuantity(line.unitPrice, line.quantity, 'floor'));
  }

  const marginAmount = subRp(totalPrice, totalCost);
  const marginBp = ratioBp(marginAmount, totalPrice);

  return { totalCost, totalPrice, marginAmount, marginBp };
}

/**
 * "Margin di bawah floor memicu warning" (ARCHITECTURE.md 8's exit
 * criterion, verbatim). `marginBp === null` (nothing priced yet) is
 * deliberately not a warning -- there is nothing to warn about until an
 * estimate actually has priced lines, the same "zero need is green" shape
 * computeFundingCoverage already uses for its own null case.
 */
export function isBelowMarginFloor(marginBp: BasisPoints | null, marginFloorBp: BasisPoints): boolean {
  if (marginBp === null) return false;
  return marginBp < marginFloorBp;
}
