'use server';

import { toRupiah } from '@/core/money/rupiah';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getVendorAction,
  getVendorQuoteAction,
  listVendorQuotesForProjectAction,
  type VendorQuote,
} from '@/modules/procurement';
import { completeWithClaude } from '../data/claude-client';
import { insertAiGeneration } from '../data/ai-generations-repository';
import { generateQuoteSummarySchema } from '../schemas';
import { assertWithinBudget } from './budget-guard';

export type QuoteSummaryResult = {
  readonly quotes: readonly { readonly vendorName: string; readonly description: string; readonly amount: string }[];
  readonly summary: string;
};

/**
 * Never writes to `vendor_quotes` or anything else -- purely informational,
 * the same "advisory, nothing to save" shape as delay detection (not every
 * ai-scribe feature pre-fills a form; some just help a human decide,
 * ADR 0020 SS6). Reads modules/procurement only through its own public API.
 */
export const generateQuoteSummaryAction = safeAction(
  {
    schema: generateQuoteSummarySchema,
    permission: { resource: 'ai_generation', action: 'create' },
    loadContext: getActionContext,
    name: 'aiScribe.generateQuoteSummary',
  },
  async (input, ctx): Promise<QuoteSummaryResult> => {
    const quoteResult = await getVendorQuoteAction(input.vendorQuoteId);
    if (!quoteResult.ok) {
      throw new Error(`Failed to load vendor quote for summary: ${quoteResult.error.message}`);
    }
    const quote = quoteResult.data;

    // Siblings sharing the same material_request_id, if any (ADR 0020 SS6);
    // a quote with no material_request_id is compared against nothing but
    // itself -- still worth one sentence, not blocked for lack of siblings.
    let siblings: VendorQuote[] = [quote];
    if (quote.material_request_id !== null) {
      const projectQuotesResult = await listVendorQuotesForProjectAction(quote.project_id);
      if (projectQuotesResult.ok) {
        siblings = projectQuotesResult.data.filter((q) => q.material_request_id === quote.material_request_id);
      }
    }

    const vendorNames = new Map<string, string>();
    await Promise.all(
      [...new Set(siblings.map((q) => q.vendor_id))].map(async (vendorId) => {
        const vendorResult = await getVendorAction(vendorId);
        vendorNames.set(vendorId, vendorResult.ok ? vendorResult.data.name : 'Vendor tidak diketahui');
      }),
    );

    const supabase = await createServerSupabase();
    await assertWithinBudget(supabase, ctx.organizationId);

    const model = 'claude-haiku-4-5';
    const completion = await completeWithClaude({
      model,
      maxTokens: 200,
      system:
        'You compare vendor price quotes for a construction procurement tool. Given a list of vendor name, ' +
        'description, and amount (Rupiah) in Indonesian, write 1-2 short Indonesian sentences noting which looks ' +
        'like the better value and why, as an observation for a human to weigh -- never state it as the decision.',
      prompt: siblings
        .map((q) => `${vendorNames.get(q.vendor_id) ?? 'Vendor'}: ${q.description} -- Rp ${q.amount.toLocaleString('id-ID')}`)
        .join('\n'),
    });

    await insertAiGeneration(supabase, {
      organization_id: ctx.organizationId,
      project_id: quote.project_id,
      feature: 'quote_summary',
      model,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      cost_amount: toRupiah(completion.costAmount),
      requested_by: ctx.userId,
    });

    return {
      quotes: siblings.map((q) => ({
        vendorName: vendorNames.get(q.vendor_id) ?? 'Vendor',
        description: q.description,
        amount: `Rp ${q.amount.toLocaleString('id-ID')}`,
      })),
      summary: completion.text.trim(),
    };
  },
);
