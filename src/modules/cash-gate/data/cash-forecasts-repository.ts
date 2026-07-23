import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Tables } from '@/core/db/database.types';
import type { CashForecast, NewCashForecast } from '../types';

/** All direct `cash_forecasts` table access lives here (ARCHITECTURE.md 1.2). */

function toCashForecast(row: Tables<'cash_forecasts'>): CashForecast {
  return { ...row, needed_amount: rupiahFromColumn(row.needed_amount) };
}

export async function listCashForecastsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<CashForecast[]> {
  const { data, error } = await supabase
    .from('cash_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('needed_by_date');

  if (error !== null) throw error;
  return data.map(toCashForecast);
}

export async function insertCashForecast(supabase: ServerSupabase, input: NewCashForecast): Promise<CashForecast> {
  const { data, error } = await supabase
    .from('cash_forecasts')
    .insert({ ...input, needed_amount: rupiahToColumn(input.needed_amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return toCashForecast(data);
}
