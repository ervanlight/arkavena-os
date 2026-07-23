import { toRupiah, type Rupiah } from '@/core/money/rupiah';

/**
 * The org-wide monthly budget cap (ADR 0020 SS4) -- a placeholder number,
 * not a researched one, flagged in the ADR for the Owner to correct once
 * real cost-per-generation data exists.
 */
export const AI_MONTHLY_BUDGET_CAP: Rupiah = toRupiah(300_000);

/**
 * Whether spending so far this month already meets or exceeds the cap.
 * Pure: the caller sums this calendar month's ai_generations.cost_amount
 * for the organization and passes the total in -- domain/ never queries a
 * database (ARCHITECTURE.md 4.1).
 */
export function isOverBudget(spentThisMonth: Rupiah, cap: Rupiah = AI_MONTHLY_BUDGET_CAP): boolean {
  return spentThisMonth >= cap;
}
