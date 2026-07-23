'use server';

import { toRupiah } from '@/core/money/rupiah';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { completeWithClaude } from '../data/claude-client';
import { insertAiGeneration } from '../data/ai-generations-repository';
import { generateIssueClassificationSchema } from '../schemas';
import { assertWithinBudget } from './budget-guard';

const SEVERITIES = ['low', 'medium', 'high'] as const;

export type IssueClassificationSuggestion = {
  readonly suggestedSeverity: (typeof SEVERITIES)[number];
  readonly suggestedCategory: string;
};

function parseSuggestion(text: string): IssueClassificationSuggestion {
  const severityMatch = text.match(/severity:\s*(low|medium|high)/i);
  const categoryMatch = text.match(/category:\s*(.+)/i);

  const suggestedSeverity = (severityMatch?.[1]?.toLowerCase() ?? 'medium') as (typeof SEVERITIES)[number];

  return {
    suggestedSeverity: SEVERITIES.includes(suggestedSeverity) ? suggestedSeverity : 'medium',
    suggestedCategory: categoryMatch?.[1]?.trim() ?? 'lainnya',
  };
}

/**
 * Never writes to `issues` (ADR 0020 SS2) -- the issue does not exist yet at
 * classification time. Returns a suggestion the create-issue form pre-fills;
 * the human reviews, edits, and submits through the existing
 * createIssueAction, unchanged.
 */
export const generateIssueClassificationAction = safeAction(
  {
    schema: generateIssueClassificationSchema,
    permission: { resource: 'ai_generation', action: 'create' },
    loadContext: getActionContext,
    name: 'aiScribe.generateIssueClassification',
  },
  async (input, ctx): Promise<IssueClassificationSuggestion> => {
    const supabase = await createServerSupabase();
    await assertWithinBudget(supabase, ctx.organizationId);

    const model = 'claude-haiku-4-5';
    const completion = await completeWithClaude({
      model,
      maxTokens: 200,
      system:
        'You classify construction-site issue reports for a project management tool. ' +
        'Given a title and optional description in Indonesian, respond with exactly two lines:\n' +
        'severity: low|medium|high\n' +
        'category: <a short Indonesian category tag, e.g. "struktur", "elektrikal", "keselamatan">\n' +
        'Nothing else. This is a suggestion a human reviews before saving -- never state it as a decision.',
      prompt: `Judul: ${input.title}\n${input.description !== undefined ? `Deskripsi: ${input.description}` : ''}`,
    });

    await insertAiGeneration(supabase, {
      organization_id: ctx.organizationId,
      project_id: null,
      feature: 'issue_classification',
      model,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      cost_amount: toRupiah(completion.costAmount),
      requested_by: ctx.userId,
    });

    return parseSuggestion(completion.text);
  },
);
