import { createServerSupabase } from '@/core/db/client.server';

export async function getOfficialRab(projectId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('estimates')
    .select(`
      *,
      estimate_items (*)
    `)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data; // returns the latest estimate or null
}

export async function getPendingVendorRabs(projectId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('vendor_quotes')
    .select(`
      *,
      vendor_quote_items (*)
    `)
    .eq('project_id', projectId)
    .eq('status', 'received')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
