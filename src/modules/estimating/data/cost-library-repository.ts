import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { CostLibraryItem, CostLibraryItemUpdate, NewCostLibraryItem } from '../types';

/** All direct `cost_library` table access lives here (ARCHITECTURE.md 1.2). */

function toCostLibraryItem(row: Omit<CostLibraryItem, 'default_unit_cost'> & { default_unit_cost: number }): CostLibraryItem {
  return { ...row, default_unit_cost: rupiahFromColumn(row.default_unit_cost) };
}

export async function listCostLibraryItems(supabase: ServerSupabase): Promise<CostLibraryItem[]> {
  const { data, error } = await supabase
    .from('cost_library')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error !== null) throw error;
  return data.map(toCostLibraryItem);
}

export async function getCostLibraryItem(supabase: ServerSupabase, id: string): Promise<CostLibraryItem> {
  const { data, error } = await supabase
    .from('cost_library')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Cost library item ${id} not found`, { meta: { costLibraryItemId: id } });
  }
  return toCostLibraryItem(data);
}

export async function insertCostLibraryItem(
  supabase: ServerSupabase,
  input: NewCostLibraryItem,
): Promise<CostLibraryItem> {
  const { default_unit_cost, ...rest } = input;
  const { data, error } = await supabase
    .from('cost_library')
    .insert({ ...rest, default_unit_cost: rupiahToColumn(default_unit_cost) })
    .select()
    .single();

  if (error !== null) throw error;
  return toCostLibraryItem(data);
}

export async function updateCostLibraryItem(
  supabase: ServerSupabase,
  id: string,
  patch: CostLibraryItemUpdate,
): Promise<CostLibraryItem> {
  const { default_unit_cost, ...rest } = patch;
  const { data, error } = await supabase
    .from('cost_library')
    .update({ ...rest, ...(default_unit_cost !== undefined ? { default_unit_cost: rupiahToColumn(default_unit_cost) } : {}) })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Cost library item ${id} not found`, { meta: { costLibraryItemId: id } });
  }
  return toCostLibraryItem(data);
}
