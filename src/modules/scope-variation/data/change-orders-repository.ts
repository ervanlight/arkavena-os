import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { Tables } from '@/core/db/database.types';
import type { ChangeOrder, ChangeOrderUpdate, NewChangeOrder } from '../types';

/** All direct `change_orders` table access lives here (ARCHITECTURE.md 1.2). */

function toChangeOrder(row: Tables<'change_orders'>): ChangeOrder {
  return {
    ...row,
    cost_impact_amount: row.cost_impact_amount === null ? null : rupiahFromColumn(row.cost_impact_amount),
  };
}

export async function listChangeOrdersForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ChangeOrder[]> {
  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list change orders for project ${projectId}: ${error.message}`);
  }
  return data.map(toChangeOrder);
}

export async function getChangeOrder(supabase: ServerSupabase, id: string): Promise<ChangeOrder> {
  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load change order ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Change order ${id} not found`, { meta: { changeOrderId: id } });
  }
  return toChangeOrder(data);
}

export async function insertChangeOrder(supabase: ServerSupabase, input: NewChangeOrder): Promise<ChangeOrder> {
  const { data, error } = await supabase.from('change_orders').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create change order: ${error.message}`);
  }
  return toChangeOrder(data);
}

/**
 * The one write path for every lifecycle event (submit_review, send_to_client,
 * reject, client_approve, client_reject, funding_received, complete) --
 * each action builds the right patch (status + whichever tracking columns
 * that event owns) and passes it here. trg_change_orders_guard_transition
 * and trg_change_orders_guard_client_columns both still apply regardless of
 * which action called this.
 */
export async function updateChangeOrder(
  supabase: ServerSupabase,
  id: string,
  patch: ChangeOrderUpdate,
): Promise<ChangeOrder> {
  const { cost_impact_amount, ...rest } = patch;
  const { data, error } = await supabase
    .from('change_orders')
    .update({
      ...rest,
      ...(cost_impact_amount !== undefined
        ? { cost_impact_amount: cost_impact_amount === null ? null : rupiahToColumn(cost_impact_amount) }
        : {}),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update change order ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Change order ${id} not found`, { meta: { changeOrderId: id } });
  }
  return toChangeOrder(data);
}
