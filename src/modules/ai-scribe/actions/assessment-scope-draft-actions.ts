'use server';

import { toRupiah } from '@/core/money/rupiah';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { getAssessmentAction } from '@/modules/assessment';
import { completeWithClaude } from '../data/claude-client';
import { insertAiGeneration } from '../data/ai-generations-repository';
import { generateAssessmentScopeDraftSchema } from '../schemas';
import { assertWithinBudget } from './budget-guard';

export type AssessmentScopeDraftResult = {
  readonly suggestedScope: string;
};

/**
 * Never writes to `assessments` -- returns a suggestion the existing
 * FindingsForm pre-fills into recommended_scope; the human reviews, edits,
 * and saves through updateAssessmentFindingsAction, unchanged (ADR 0020 SS2).
 * Reads modules/assessment only through its own public API (ADR 0020 SS5).
 */
export const generateAssessmentScopeDraftAction = safeAction(
  {
    schema: generateAssessmentScopeDraftSchema,
    permission: { resource: 'ai_generation', action: 'create' },
    loadContext: getActionContext,
    name: 'aiScribe.generateAssessmentScopeDraft',
  },
  async (input, ctx): Promise<AssessmentScopeDraftResult> => {
    const assessmentResult = await getAssessmentAction(input.assessmentId);
    if (!assessmentResult.ok) {
      throw new Error(`Failed to load assessment for scope draft: ${assessmentResult.error.message}`);
    }
    const assessment = assessmentResult.data;

    if (assessment.site_conditions === null || assessment.site_conditions.trim() === '') {
      throw new DomainRuleError(
        ERROR_CODES.VALIDATION_FAILED,
        'Assessment has no site_conditions to draft a scope from',
        { userMessage: 'Isi kondisi lokasi dulu sebelum meminta saran ruang lingkup.' },
      );
    }

    const supabase = await createServerSupabase();
    await assertWithinBudget(supabase, ctx.organizationId);

    const model = 'claude-sonnet-5';
    const completion = await completeWithClaude({
      model,
      maxTokens: 300,
      system:
        'You draft a recommended scope of work for a construction renovation/repair assessment, in Indonesian, ' +
        '2-4 sentences, given the site conditions a staff member observed. This is a draft a human reviews and ' +
        'edits before saving -- never phrase it as a final decision or a quote.',
      prompt: `Kondisi lokasi: ${assessment.site_conditions}`,
    });

    await insertAiGeneration(supabase, {
      organization_id: ctx.organizationId,
      project_id: assessment.project_id,
      feature: 'assessment_scope_draft',
      model,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      cost_amount: toRupiah(completion.costAmount),
      requested_by: ctx.userId,
    });

    return { suggestedScope: completion.text.trim() };
  },
);
