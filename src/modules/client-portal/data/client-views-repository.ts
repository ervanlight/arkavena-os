import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { ClientProgressPhoto, ClientProjectOverview, ClientTimelineEvent, ClientZoneProgress } from '../types';

/**
 * All direct access to the vw_client_* views (ARCHITECTURE.md 2.6, ADR 0016)
 * lives here -- the only surface the client portal reads. Every view is
 * `security_invoker = true`, so RLS on the underlying tables (scoped to
 * client_approver/client_viewer via fn_has_project_role) is what actually
 * gates a row showing up here, not this file.
 */

export async function getClientProjectOverview(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientProjectOverview | null> {
  const { data, error } = await supabase
    .from('vw_client_project_overview')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error !== null) throw error;
  return data;
}

export async function listClientZoneProgress(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientZoneProgress[]> {
  const { data, error } = await supabase.from('vw_client_zone_progress').select('*').eq('project_id', projectId);

  if (error !== null) throw error;
  return data;
}

export async function listClientTimelineEvents(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientTimelineEvent[]> {
  const { data, error } = await supabase
    .from('vw_client_timeline_event')
    .select('*')
    .eq('project_id', projectId)
    .order('event_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function listClientProgressPhotos(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientProgressPhoto[]> {
  const { data, error } = await supabase
    .from('vw_client_progress_photo')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}
