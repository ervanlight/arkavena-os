import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { VendorUser } from '../types';

export async function insertVendorUser(
  supabase: ServerSupabase,
  input: { vendor_id: string; user_id: string },
): Promise<VendorUser> {
  const { data, error } = await supabase.from('vendor_users').insert(input).select().single();
  if (error !== null) throw error;
  return data;
}
