import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import { getDownloadPresignedUrl } from '@/core/storage/r2.server';
import type { Evidence, EvidenceWithUrl, NewEvidence } from '../types';

const THUMBNAIL_URL_TTL_SECONDS = 60 * 60; // 1 hour -- one page view's worth, same TTL as client-portal's photo signing.

/** All direct `evidence` table access lives here (ARCHITECTURE.md 1.2). */

export async function insertEvidence(supabase: ServerSupabase, input: NewEvidence): Promise<Evidence> {
  const { data, error } = await supabase.from('evidence').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function listEvidenceForActivity(
  supabase: ServerSupabase,
  activityTable: string,
  activityId: string,
): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('activity_table', activityTable)
    .eq('activity_id', activityId)
    .is('deleted_at', null)
    .order('captured_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

/** The Client Timeline's own read: this project's client-visible evidence, newest first (idx_evidence_project_visibility_captured backs this exactly). */
export async function listClientVisibleEvidenceForProject(supabase: ServerSupabase, projectId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('project_id', projectId)
    .eq('visibility', 'client_visible')
    .is('deleted_at', null)
    .order('captured_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export type EvidenceWithProject = Evidence & {
  project_name: string;
  url: string | null;
};

export async function listDocumentEvidence(supabase: ServerSupabase): Promise<EvidenceWithProject[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*, projects(name)')
    .eq('evidence_type', 'document')
    .is('deleted_at', null)
    .order('captured_at', { ascending: false });

  if (error !== null) throw error;

  return Promise.all(
    data.map(async (row: any) => {
      let url: string | null = null;
      if (row.storage_path) {
        try {
          url = await getDownloadPresignedUrl(row.storage_path, 3600);
        } catch {
          url = null;
        }
      }
      return {
        ...row,
        project_name: row.projects?.name ?? 'Unknown Project',
        url,
      };
    }),
  );
}

/** The Client Timeline's own read, with browser-loadable thumbnail URLs resolved (ADR 0026 §4.2 "Hari Ini"/"Update Terbaru"). */
export async function listClientVisibleEvidenceWithUrlsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<EvidenceWithUrl[]> {
  const rows = await listClientVisibleEvidenceForProject(supabase, projectId);

  return Promise.all(
    rows.map(async ({ thumbnail_path, storage_path: _storagePath, ...rest }) => {
      if (thumbnail_path === null) return { ...rest, thumbnailUrl: null };
      const signedUrl = await getDownloadPresignedUrl(thumbnail_path, THUMBNAIL_URL_TTL_SECONDS);
      return { ...rest, thumbnailUrl: signedUrl };
    }),
  );
}

export async function updateEvidenceVisibilityForActivity(
  supabase: ServerSupabase,
  activityTable: string,
  activityId: string,
  visibility: Evidence['visibility'],
): Promise<void> {
  const { error } = await supabase
    .from('evidence')
    .update({ visibility })
    .eq('activity_table', activityTable)
    .eq('activity_id', activityId);

  if (error !== null) throw error;
}

/** ADR 0026 §3.3: promotes a held-back row to client_visible, the side effect of another module's own approval action. */
export async function releaseEvidence(supabase: ServerSupabase, evidenceId: string): Promise<Evidence> {
  const { data, error } = await supabase
    .from('evidence')
    .update({ visibility: 'client_visible' })
    .eq('id', evidenceId)
    .eq('visibility', 'visible_after_approval')
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Evidence ${evidenceId} not found, or not awaiting approval`, { meta: { evidenceId } });
  }
  return data;
}
