import 'server-only';
import { rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import type { AiGeneration, NewAiGeneration } from '../types';

/** All direct `ai_generations` table access lives here (ARCHITECTURE.md 1.2). */

export async function insertAiGeneration(supabase: ServerSupabase, input: NewAiGeneration): Promise<AiGeneration> {
  const { cost_amount, ...rest } = input;
  const { data, error } = await supabase
    .from('ai_generations')
    .insert({ ...rest, cost_amount: rupiahToColumn(cost_amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return { ...data, cost_amount: cost_amount };
}

/**
 * Sum of cost_amount for this organization since the start of the current
 * calendar month, in the column's own raw integer form -- the budget-cap
 * check (modules/ai-scribe/domain/budget-cap.ts) converts it to Rupiah at
 * the call site, same "conversion happens once, at the boundary" pattern
 * maintenance-engine's own date<->epoch-ms conversion already established.
 */
export async function sumAiGenerationCostThisMonth(
  supabase: ServerSupabase,
  organizationId: string,
  monthStartIso: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('ai_generations')
    .select('cost_amount')
    .eq('organization_id', organizationId)
    .gte('created_at', monthStartIso);

  if (error !== null) throw error;
  return data.reduce((sum, row) => sum + row.cost_amount, 0);
}
