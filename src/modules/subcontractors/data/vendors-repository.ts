import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Database } from '@/core/db/database.types';

export type Vendor = Database['public']['Tables']['vendors']['Row'];

export async function listVendors(supabase: ServerSupabase): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error !== null) throw error;
  return data;
}
