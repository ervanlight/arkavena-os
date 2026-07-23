import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { EstimateItem, EstimateItemUpdate, NewEstimateItem } from '../types';

/** All direct `estimate_items` table access lives here (ARCHITECTURE.md 1.2). */

function toEstimateItem(
  row: Omit<EstimateItem, 'unit_cost' | 'unit_price'> & { unit_cost: number; unit_price: number },
): EstimateItem {
  return { ...row, unit_cost: rupiahFromColumn(row.unit_cost), unit_price: rupiahFromColumn(row.unit_price) };
}

export async function listEstimateItemsForEstimate(
  supabase: ServerSupabase,
  estimateId: string,
): Promise<EstimateItem[]> {
  const { data, error } = await supabase
    .from('estimate_items')
    .select('*')
    .eq('estimate_id', estimateId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error !== null) throw error;
  return data.map(toEstimateItem);
}

export async function getEstimateItem(supabase: ServerSupabase, id: string): Promise<EstimateItem> {
  const { data, error } = await supabase
    .from('estimate_items')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Estimate item ${id} not found`, { meta: { estimateItemId: id } });
  }
  return toEstimateItem(data);
}

export async function insertEstimateItem(supabase: ServerSupabase, input: NewEstimateItem): Promise<EstimateItem> {
  const { unit_cost, unit_price, ...rest } = input;
  const { data, error } = await supabase
    .from('estimate_items')
    .insert({ ...rest, unit_cost: rupiahToColumn(unit_cost), unit_price: rupiahToColumn(unit_price) })
    .select()
    .single();

  if (error !== null) throw error;
  return toEstimateItem(data);
}

export async function updateEstimateItem(
  supabase: ServerSupabase,
  id: string,
  patch: EstimateItemUpdate,
): Promise<EstimateItem> {
  const { unit_cost, unit_price, ...rest } = patch;
  const { data, error } = await supabase
    .from('estimate_items')
    .update({
      ...rest,
      ...(unit_cost !== undefined ? { unit_cost: rupiahToColumn(unit_cost) } : {}),
      ...(unit_price !== undefined ? { unit_price: rupiahToColumn(unit_price) } : {}),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Estimate item ${id} not found`, { meta: { estimateItemId: id } });
  }
  return toEstimateItem(data);
}
