'use server';

import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getProjectRiskReserveRow, upsertProjectRiskReserve } from '../data/project-risk-reserves-repository';
import { setRiskReserveSchema } from '../schemas';
import type { ProjectRiskReserve } from '../types';

/** Owner/Finance configuring the Cash Gate's risk buffer for a project (ADR 0009 decision 4, ADR 0011). */
export const setRiskReserveAction = safeAction(
  {
    schema: setRiskReserveSchema,
    permission: { resource: 'project_risk_reserve', action: 'update' },
    loadContext: getActionContext,
    name: 'cashGate.setRiskReserve',
  },
  async (input, ctx): Promise<ProjectRiskReserve> => {
    const supabase = await createServerSupabase();
    const before = await getProjectRiskReserveRow(supabase, input.projectId);

    const after = await upsertProjectRiskReserve(
      supabase,
      ctx.organizationId,
      input.projectId,
      toRupiah(input.riskReserveAmount),
    );

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'project_risk_reserves',
      entityId: after.id,
      action: 'update',
      previousValue: { risk_reserve_amount: before?.risk_reserve_amount.toString() ?? '0' },
      newValue: { risk_reserve_amount: after.risk_reserve_amount.toString() },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);
