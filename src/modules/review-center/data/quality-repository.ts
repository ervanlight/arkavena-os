import { createServerSupabase } from '@/core/db/client.server';
import { InfraError } from '@/core/errors/app-error';
import type { Inspection } from '../types';

export async function listPendingInspections(projectId?: string): Promise<Inspection[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('inspections')
    .select(`
      *,
      projects (id, name),
      zones (id, name),
      work_packages (id, name),
      hold_point_templates (id, name, description)
    `)
    .eq('status', 'pending')
    .is('deleted_at', null);
    
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new InfraError('Failed to fetch pending inspections', { cause: error });
  }
  
  return data as any as Inspection[];
}

export async function getInspection(id: string): Promise<Inspection | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('inspections')
    .select(`
      *,
      projects (id, name),
      zones (id, name),
      work_packages (id, name),
      hold_point_templates (id, name, description)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    throw new InfraError('Failed to fetch inspection', { cause: error });
  }
  
  return data as any as Inspection;
}
