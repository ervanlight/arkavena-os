'use server';

import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { requirePermission } from '@/core/permissions/guard';
import { withAudit } from '@/core/audit/audit';
import { createServerSupabase } from '@/core/db/client.server';
import { transitionInspection } from '../domain/quality-gate';
import { getInspection } from '../data/quality-repository';
import { revalidatePath } from 'next/cache';

const reviewHoldPointSchema = z.object({
  inspectionId: z.string().uuid(),
  decision: z.enum(['pass', 'fail', 'override']),
  reason: z.string().optional(),
});

export const reviewHoldPointAction = safeAction(
  {
    schema: reviewHoldPointSchema,
    name: 'reviewCenter.reviewHoldPoint',
    loadContext: getActionContext,
  },
  async (input, ctx) => {
    // 1. Check permissions
    if (input.decision === 'override') {
      requirePermission(ctx, 'inspection', 'override');
    } else {
      requirePermission(ctx, 'inspection', 'update');
    }

    // 2. Load state
    const current = await getInspection(input.inspectionId);
    if (!current) {
      throw new Error('Inspection not found');
    }

    // 3. Domain rules
    const result = transitionInspection(current, input.decision, input.reason);
    if (!result.ok) throw result.error;

    // 4. Mutate DB & Audit
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const updateData: any = { updated_at: now };
    
    if (input.decision === 'override') {
      updateData.status = 'passed'; // An override acts as a pass for the gate
      updateData.overridden_by = ctx.userId;
      updateData.override_reason = input.reason;
      updateData.overridden_at = now;
    } else {
      updateData.status = input.decision === 'pass' ? 'passed' : 'failed';
      updateData.inspected_by = ctx.userId;
      updateData.inspected_at = now;
      if (input.reason) updateData.notes = input.reason;
    }

    const newValue = await withAudit(
      createAuditGateway(supabase),
      {
        entityTable: 'inspections',
        entityId: current.id,
        projectId: current.project_id,
        action: input.decision === 'override' ? 'override' : 'status_change',
        previousValue: current,
        newValue: { ...current, ...updateData },
        ...(input.reason ? { reason: input.reason } : {}),
      },
      async () => {
        const { data, error } = await supabase
          .from('inspections')
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
