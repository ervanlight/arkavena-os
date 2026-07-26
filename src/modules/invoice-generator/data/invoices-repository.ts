import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Invoice, InvoiceUpdate, NewInvoice } from '../types';

/** All direct `invoices` table access lives here (ARCHITECTURE.md 1.2). */

function toInvoice(row: Omit<Invoice, 'amount'> & { amount: number }): Invoice {
  return { ...row, amount: rupiahFromColumn(row.amount) };
}

export async function listInvoicesForProject(supabase: ServerSupabase, projectId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data.map(toInvoice);
}

/** Every issued, not-yet-fully-paid invoice across the org -- the aging dashboard's source. */
export async function listIssuedUnpaidInvoices(supabase: ServerSupabase): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'issued')
    .is('deleted_at', null)
    .order('due_date', { ascending: true });

  if (error !== null) throw error;
  return data.map(toInvoice);
}

export async function getInvoice(supabase: ServerSupabase, id: string): Promise<Invoice> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Invoice ${id} not found`, { meta: { invoiceId: id } });
  }
  return toInvoice(data);
}

export async function insertInvoice(supabase: ServerSupabase, input: NewInvoice): Promise<Invoice> {
  const { amount, ...rest } = input;
  const { data, error } = await supabase
    .from('invoices')
    .insert({ ...rest, amount: rupiahToColumn(amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return toInvoice(data);
}

export async function updateInvoice(supabase: ServerSupabase, id: string, patch: InvoiceUpdate): Promise<Invoice> {
  const { amount, ...rest } = patch;
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...rest, ...(amount !== undefined ? { amount: rupiahToColumn(amount) } : {}) })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Invoice ${id} not found`, { meta: { invoiceId: id } });
  }
  return toInvoice(data);
}
