'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getPurchaseOrder,
  insertPurchaseOrder,
  listPurchaseOrdersForProject,
  overrideAndIssuePurchaseOrder,
} from '../data/purchase-orders-repository';
import { createPurchaseOrderSchema, overrideIssuePurchaseOrderSchema } from '../schemas';
import type { PurchaseOrder } from '../types';

/**
 * A plain INSERT -- there is no status to transition into, the row itself is
 * the issuance (ADR 0018 SS6). trg_purchase_orders_guard_cash_gate rejects it
 * outright under a red/overdue gate; the resulting Postgres exception (hinted,
 * ARCHITECTURE.md 4.2) surfaces through asAppError as a user-safe
 * ValidationError, the same path fn_work_packages_guard_cash_gate uses
 * (ADR 0015 -- no dedicated CASH_GATE_RED code, repositories never translate
 * the trigger's error themselves).
 */
export const createPurchaseOrderAction = safeAction(
  {
    schema: createPurchaseOrderSchema,
    permission: { resource: 'purchase_order', action: 'create' },
    loadContext: getActionContext,
    name: 'procurement.createPurchaseOrder',
  },
  async (input, ctx): Promise<PurchaseOrder> => {
    const supabase = await createServerSupabase();
    const po = await insertPurchaseOrder(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      vendor_id: input.vendorId,
      vendor_quote_id: input.vendorQuoteId ?? null,
      material_request_id: input.materialRequestId ?? null,
      description: input.description,
      amount: toRupiah(input.amount),
      issued_by: ctx.userId,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'purchase_orders',
      entityId: po.id,
      action: 'insert',
      newValue: po,
      projectId: po.project_id,
      requestId: ctx.requestId,
    });

    return po;
  },
);

/**
 * The one path that issues a PO under a red/overdue gate (ADR 0010). RLS lets
 * any staff member's row through and trg_cash_gate_overrides_guard_owner_only
 * is the real authority, but requirePermission() below (cash_gate_override.create
 * -> owner only) gives a friendly Indonesian refusal before the request ever
 * reaches the database for anyone else -- same split as
 * overrideOpenWorkPackageAction in modules/cash-gate.
 */
export const overrideIssuePurchaseOrderAction = safeAction(
  {
    schema: overrideIssuePurchaseOrderSchema,
    permission: { resource: 'cash_gate_override', action: 'create' },
    loadContext: getActionContext,
    name: 'procurement.overrideIssuePurchaseOrder',
  },
  async (input, ctx): Promise<PurchaseOrder> => {
    const supabase = await createServerSupabase();
    const po = await overrideAndIssuePurchaseOrder(supabase, {
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      vendorId: input.vendorId,
      ...(input.vendorQuoteId !== undefined ? { vendorQuoteId: input.vendorQuoteId } : {}),
      description: input.description,
      amount: toRupiah(input.amount),
      reason: input.reason,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'purchase_orders',
      entityId: po.id,
      action: 'override',
      reason: input.reason,
      newValue: po,
      projectId: po.project_id,
      requestId: ctx.requestId,
    });

    return po;
  },
);

export const listPurchaseOrdersForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'purchase_order', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.listPurchaseOrdersForProject',
  },
  async (projectId): Promise<PurchaseOrder[]> => {
    const supabase = await createServerSupabase();
    return listPurchaseOrdersForProject(supabase, projectId);
  },
);

export const getPurchaseOrderAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'purchase_order', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.getPurchaseOrder',
  },
  async (id): Promise<PurchaseOrder> => {
    const supabase = await createServerSupabase();
    return getPurchaseOrder(supabase, id);
  },
);
