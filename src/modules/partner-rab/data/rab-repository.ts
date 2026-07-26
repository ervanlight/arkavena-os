import { createServerSupabase } from '@/core/db/client.server';
import type { Database } from '@/core/db/database.types';

export type VendorQuoteItem = Database['public']['Tables']['vendor_quote_items']['Row'];
export type VendorQuoteItemInsert = Database['public']['Tables']['vendor_quote_items']['Insert'];

export async function getVendorQuoteItems(quoteId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('vendor_quote_items')
    .select('*')
    .eq('vendor_quote_id', quoteId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function saveVendorQuoteItem(item: VendorQuoteItemInsert) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('vendor_quote_items')
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVendorQuoteItem(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('vendor_quote_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateVendorQuoteTotalAmount(quoteId: string) {
  const supabase = await createServerSupabase();
  
  // Get all items to sum them up
  const items = await getVendorQuoteItems(quoteId);
  const total = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);

  const { error } = await supabase
    .from('vendor_quotes')
    .update({ amount: total })
    .eq('id', quoteId);

  if (error) throw error;
  return total;
}
