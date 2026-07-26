import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { withAudit } from '@/core/audit/audit';
import { createServerSupabase } from '@/core/db/client.server';
import { getQuote } from '../data/quotes-repository';
import { revalidatePath } from 'next/cache';
import { DomainRuleError } from '@/core/errors/app-error';

const reviewQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  reason: z.string().optional(),
});

export const reviewSubconQuoteAction = safeAction(
  {
    schema: reviewQuoteSchema,
    name: 'reviewCenter.reviewSubconQuote',
    loadContext: getActionContext,
    permission: { resource: 'vendor_quote', action: 'update' }
  },
  async (input, _ctx) => {
    // 2. Load state
    const current = await getQuote(input.quoteId);
    if (!current) {
      throw new Error('Quote not found');
    }
    
    if (current.status !== 'received') {
      throw new DomainRuleError('VALIDATION_FAILED', 'Quote is already decided.');
    }

    // 3. Mutate DB & Audit
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const updateData = {
      status: input.decision,
      updated_at: now,
      ...(input.reason ? { notes: input.reason } : {})
    };

    const newValue = await withAudit(
      createAuditGateway(supabase),
      {
        entityTable: 'vendor_quotes',
        entityId: current.id,
        projectId: current.project_id,
        action: 'status_change',
        previousValue: current,
        newValue: { ...current, ...updateData },
        ...(input.reason ? { reason: input.reason } : {}),
      },
      async () => {
        const { data, error } = await supabase
          .from('vendor_quotes')
          .update(updateData)
          .eq('id', current.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    );

    revalidatePath('/cc');
    revalidatePath(`/cc/projects/${current.project_id}`);
    
    return { ok: true, data: newValue };
  }
);
