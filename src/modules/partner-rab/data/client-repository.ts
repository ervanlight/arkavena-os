import { createServerSupabase } from '@/core/db/client.server';

export async function getClientProposal(projectId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      estimates (
        *,
        estimate_items (*)
      )
    `)
    .eq('project_id', projectId)
    .in('status', ['sent', 'accepted', 'rejected'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
