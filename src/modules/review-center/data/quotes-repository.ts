import { createServerSupabase } from '@/core/db/client.server';
import { InfraError } from '@/core/errors/app-error';
import type { VendorQuote } from '../types';

export async function listPendingQuotes(projectId?: string): Promise<VendorQuote[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('vendor_quotes')
    .select(`
      *,
      projects (id, name),
      vendors (id, name)
    `)
    .eq('status', 'received')
    .is('deleted_at', null);
    
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new InfraError('Failed to fetch pending quotes', { cause: error });
  }
  
  return data as any as VendorQuote[];
}

export async function getQuote(id: string): Promise<VendorQuote | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('vendor_quotes')
    .select(`
      *,
      projects (id, name),
      vendors (id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    throw new InfraError('Failed to fetch quote', { cause: error });
  }
  
  return data as any as VendorQuote;
}
