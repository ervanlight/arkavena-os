import 'server-only';
import { toRupiah } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { isOverBudget } from '../domain/budget-cap';
import { sumAiGenerationCostThisMonth } from '../data/ai-generations-repository';

function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Shared by every ai-scribe action that calls Claude (ADR 0020 SS4) --
 * factored out once a fourth call site needed the identical check, rather
 * than quadruplicating it.
 */
export async function assertWithinBudget(supabase: ServerSupabase, organizationId: string): Promise<void> {
  const spentSoFar = await sumAiGenerationCostThisMonth(supabase, organizationId, startOfCurrentMonthIso());
  if (isOverBudget(toRupiah(spentSoFar))) {
    throw new DomainRuleError(ERROR_CODES.AI_BUDGET_EXCEEDED, 'Organization AI budget cap reached for this month', {
      meta: { organizationId },
    });
  }
}
