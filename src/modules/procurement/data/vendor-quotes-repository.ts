import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewVendorQuote, VendorQuote, VendorQuoteUpdate } from '../types';

/** All direct `vendor_quotes` table access lives here (ARCHITECTURE.md 1.2). */

function toVendorQuote(row: Omit<VendorQuote, 'amount'> & { amount: number }): VendorQuote {
  return { ...row, amount: rupiahFromColumn(row.amount) };
}

export async function listVendorQuotesForProject(supabase: ServerSupabase, projectId: string): Promise<VendorQuote[]> {
  const { data, error } = await supabase
    .from('vendor_quotes')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data.map(toVendorQuote);
}

export async function getVendorQuote(supabase: ServerSupabase, id: string): Promise<VendorQuote> {
  const { data, error } = await supabase
    .from('vendor_quotes')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Vendor quote ${id} not found`, { meta: { vendorQuoteId: id } });
  }
  return toVendorQuote(data);
}

export async function insertVendorQuote(supabase: ServerSupabase, input: NewVendorQuote): Promise<VendorQuote> {
  const { amount, ...rest } = input;
  const { data, error } = await supabase
    .from('vendor_quotes')
    .insert({ ...rest, amount: rupiahToColumn(amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return toVendorQuote(data);
}

export async function updateVendorQuote(
  supabase: ServerSupabase,
  id: string,
  patch: VendorQuoteUpdate,
): Promise<VendorQuote> {
  const { amount, ...rest } = patch;
  const { data, error } = await supabase
    .from('vendor_quotes')
    .update({ ...rest, ...(amount !== undefined ? { amount: rupiahToColumn(amount) } : {}) })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Vendor quote ${id} not found`, { meta: { vendorQuoteId: id } });
  }
  return toVendorQuote(data);
}
