import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import type { NewPayment, Payment } from '../types';

/** All direct `payments` table access lives here (ARCHITECTURE.md 1.2). Append-only -- no update/delete, matching the table's own RLS. */

export async function listPaymentsForInvoice(supabase: ServerSupabase, invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('paid_at', { ascending: false });

  if (error !== null) throw error;
  return data.map((row) => ({ ...row, amount: rupiahFromColumn(row.amount) }));
}

export async function insertPayment(supabase: ServerSupabase, input: NewPayment): Promise<Payment> {
  const { amount, ...rest } = input;
  const { data, error } = await supabase
    .from('payments')
    .insert({ ...rest, amount: rupiahToColumn(amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return { ...data, amount: rupiahFromColumn(data.amount) };
}
