'use server';

import { toRupiah } from '@/core/money/rupiah';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { listContractsForProjectAction, listMilestonesForContractAction } from '@/modules/projects';
import { detectOverdueMilestones, type OverdueMilestone } from '../domain/delay-detection';
import { completeWithClaude } from '../data/claude-client';
import { insertAiGeneration } from '../data/ai-generations-repository';
import { generateDelayDetectionSchema } from '../schemas';
import { assertWithinBudget } from './budget-guard';

export type DelayDetectionResult = {
  readonly overdueMilestones: readonly OverdueMilestone[];
  readonly draftSummary: string | null;
};

/**
 * Detection itself is deterministic (modules/ai-scribe/domain/delay-detection.ts) --
 * Claude only narrates a result already computed, and is never called at all
 * when nothing is overdue (ADR 0020 SS6). Never writes to `milestones` or
 * anything else; reads modules/projects only through its own public API
 * (ARCHITECTURE.md 1.2), the same "another module's public API, never its
 * repository" rule ADR 0018 SS2 already established.
 */
export const generateDelayDetectionAction = safeAction(
  {
    schema: generateDelayDetectionSchema,
    permission: { resource: 'ai_generation', action: 'create' },
    loadContext: getActionContext,
    name: 'aiScribe.generateDelayDetection',
  },
  async (input, ctx): Promise<DelayDetectionResult> => {
    const contractsResult = await listContractsForProjectAction(input.projectId);
    if (!contractsResult.ok) {
      throw new Error(`Failed to load contracts for delay detection: ${contractsResult.error.message}`);
    }

    const milestoneLists = await Promise.all(
      contractsResult.data.map(async (contract) => {
        const result = await listMilestonesForContractAction(contract.id);
        return result.ok ? result.data : [];
      }),
    );

    const milestones = milestoneLists.flat().map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      dueDateMs: milestone.due_date !== null ? Date.parse(milestone.due_date) : null,
      status: milestone.status,
    }));

    const overdueMilestones = detectOverdueMilestones(milestones, Date.now());
    if (overdueMilestones.length === 0) {
      return { overdueMilestones: [], draftSummary: null };
    }

    const supabase = await createServerSupabase();
    await assertWithinBudget(supabase, ctx.organizationId);

    const model = 'claude-haiku-4-5';
    const completion = await completeWithClaude({
      model,
      maxTokens: 150,
      system:
        'You write one short Indonesian sentence summarizing overdue project milestones for a construction ' +
        'project manager. State only the facts given -- number overdue and the worst delay -- as a plain ' +
        'observation, never as a decision or approval of anything.',
      prompt: overdueMilestones.map((m) => `${m.name}: terlambat ${m.daysOverdue} hari`).join('\n'),
    });

    await insertAiGeneration(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      feature: 'delay_detection',
      model,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      cost_amount: toRupiah(completion.costAmount),
      requested_by: ctx.userId,
    });

    return { overdueMilestones, draftSummary: completion.text.trim() };
  },
);
