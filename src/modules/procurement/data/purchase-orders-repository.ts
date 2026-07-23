import 'server-only';
import { rupiahFromColumn, rupiahToColumn, type Rupiah } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewPurchaseOrder, PurchaseOrder } from '../types';

/** All direct `purchase_orders` table access lives here (ARCHITECTURE.md 1.2). */

function toPurchaseOrder(row: Omit<PurchaseOrder, 'amount'> & { amount: number }): PurchaseOrder {
  return { ...row, amount: rupiahFromColumn(row.amount) };
}

export async function listPurchaseOrdersForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data.map(toPurchaseOrder);
}

export async function getPurchaseOrder(supabase: ServerSupabase, id: string): Promise<PurchaseOrder> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Purchase order ${id} not found`, { meta: { purchaseOrderId: id } });
  }
  return toPurchaseOrder(data);
}

/**
 * A plain INSERT -- there is no status column to transition, the row itself
 * is the issuance (ADR 0018 SS6). trg_purchase_orders_guard_cash_gate fires
 * BEFORE INSERT and rejects it outright under a red/overdue gate unless a
 * matching cash_gate_overrides row already exists; use
 * overrideAndIssuePurchaseOrder for the path that creates that row too.
 */
export async function insertPurchaseOrder(supabase: ServerSupabase, input: NewPurchaseOrder): Promise<PurchaseOrder> {
  const { amount, ...rest } = input;
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({ ...rest, amount: rupiahToColumn(amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return toPurchaseOrder(data);
}

export type OverrideIssuePurchaseOrderInput = {
  organizationId: string;
  projectId: string;
  vendorId: string;
  vendorQuoteId?: string;
  description: string;
  amount: Rupiah;
  reason: string;
};

/**
 * The one write path that issues a PO under a red/overdue gate (ADR 0010,
 * ADR 0018 SS6) -- fn_override_and_issue_purchase_order (20260723060000)
 * records the override and inserts the purchase_orders row in a single
 * transaction, mirroring overrideAndOpenWorkPackage's own RPC pattern.
 */
export async function overrideAndIssuePurchaseOrder(
  supabase: ServerSupabase,
  input: OverrideIssuePurchaseOrderInput,
): Promise<PurchaseOrder> {
  const { data, error } = await supabase
    .rpc('fn_override_and_issue_purchase_order', {
      p_organization_id: input.organizationId,
      p_project_id: input.projectId,
      p_vendor_id: input.vendorId,
      ...(input.vendorQuoteId !== undefined ? { p_vendor_quote_id: input.vendorQuoteId } : {}),
      p_description: input.description,
      p_amount: rupiahToColumn(input.amount),
      p_reason: input.reason,
    })
    .single();

  if (error !== null) throw error;
  return toPurchaseOrder(data);
}
