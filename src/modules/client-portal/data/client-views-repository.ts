import 'server-only';
import { rupiahFromColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import type { ClientProgressPhoto, ClientProjectOverview, ClientTimelineEvent, ClientZoneProgress } from '../types';

/**
 * All direct access to the vw_client_* views (ARCHITECTURE.md 2.6, ADR 0016)
 * lives here -- the only surface the client portal reads. Every view is
 * `security_invoker = true`, so RLS on the underlying tables (scoped to
 * client_approver/client_viewer via fn_has_project_role) is what actually
 * gates a row showing up here, not this file.
 *
 * Every cast to the module's own row type below narrows away nullability
 * Supabase's generator adds to every VIEW column regardless of what the
 * view's own SQL actually guarantees (see types.ts's comment) -- not a
 * widening of anything the database itself doesn't already promise.
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
  if (data === null) return null;
  return {
    ...data,
    contract_amount: data.contract_amount === null ? null : rupiahFromColumn(data.contract_amount),
  } as ClientProjectOverview;
}

export async function listClientZoneProgress(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientZoneProgress[]> {
  const { data, error } = await supabase.from('vw_client_zone_progress').select('*').eq('project_id', projectId);

  if (error !== null) throw error;
  return data as ClientZoneProgress[];
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
  return data as ClientTimelineEvent[];
}

const PHOTO_URL_TTL_SECONDS = 60 * 60; // 1 hour -- long enough for one page view, short enough not to matter if a link leaks.

/**
 * The `photos` bucket is private (Fase 4's own migration): a raw
 * `thumbnail_path` cannot be loaded by a browser directly, it needs a
 * signed URL. Resolved here, through the same authenticated `supabase`
 * client the caller already has -- `storage.objects`' own RLS
 * (photos_bucket_select_client, this wave) is what actually decides
 * whether signing succeeds for this user.
 */
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

  const photos = await Promise.all(
    data.map(async ({ thumbnail_path, storage_path: _storagePath, ...rest }) => {
      if (thumbnail_path === null) return { ...rest, thumbnailUrl: null };
      const { data: signed } = await supabase.storage.from('photos').createSignedUrl(thumbnail_path, PHOTO_URL_TTL_SECONDS);
      return { ...rest, thumbnailUrl: signed?.signedUrl ?? null };
    }),
  );
  return photos as ClientProgressPhoto[];
}
