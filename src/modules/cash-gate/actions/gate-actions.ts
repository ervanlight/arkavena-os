'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getWorkPackage } from '@/modules/projects/server';
import { loadGateState } from '../data/gate-state-repository';
import { listOverridesForProject, overrideAndOpenWorkPackage } from '../data/cash-gate-overrides-repository';
import { overrideOpenWorkPackageSchema } from '../schemas';
import type { CashGateOverrideRow, GateState, WorkPackage } from '../types';

/**
 * Reads through funding_receipt.view, not a dedicated cash_gate resource: the
 * gate state is computed entirely from funding_receipts, cash_forecasts, and
 * projects.risk_reserve_amount -- the same money data that permission already
 * gates, so a second resource just for the derived number would be one rule
 * expressed twice (CLAUDE.md 11).
 */
export const getGateStateAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'funding_receipt', action: 'view' },
    loadContext: getActionContext,
    name: 'cashGate.getGateState',
  },
  async (projectId): Promise<GateState> => {
    const supabase = await createServerSupabase();
    return loadGateState(supabase, projectId);
  },
);

export const listOverridesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'cash_gate_override', action: 'view' },
    loadContext: getActionContext,
    name: 'cashGate.listOverridesForProject',
  },
  async (projectId): Promise<CashGateOverrideRow[]> => {
    const supabase = await createServerSupabase();
    return listOverridesForProject(supabase, projectId);
  },
);

/**
 * The one path that unblocks a red/overdue gate (ADR 0010). RLS lets any
 * staff member's row through and trg_cash_gate_overrides_guard_owner_only is
 * the real authority, but requirePermission() below (cash_gate_override.create
 * -> owner only) gives a friendly Indonesian refusal before the request ever
 * reaches the database for anyone else.
 */
export const overrideOpenWorkPackageAction = safeAction(
  {
    schema: overrideOpenWorkPackageSchema,
    permission: { resource: 'cash_gate_override', action: 'create' },
    loadContext: getActionContext,
    name: 'cashGate.overrideOpenWorkPackage',
  },
  async (input, ctx): Promise<WorkPackage> => {
    const supabase = await createServerSupabase();
    const before = await getWorkPackage(supabase, input.workPackageId);
    const after = await overrideAndOpenWorkPackage(supabase, input.workPackageId, input.reason);

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'work_packages',
      entityId: after.id,
      action: 'override',
      reason: input.reason,
      previousValue: { status: before.status },
      newValue: { status: after.status },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);
