import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). */

export type ClientDecision = Tables<'client_decisions'>;

export type ClientStatusUpdate = Tables<'client_status_updates'>;
export type NewClientStatusUpdate = TablesInsert<'client_status_updates'>;

/**
 * Supabase's type generator marks every column of a VIEW as nullable --
 * views carry no NOT NULL metadata the way base tables do, regardless of
 * what the underlying columns actually guarantee. The overrides below
 * narrow back to what each view's own SQL (ADR 0016's migration) actually
 * guarantees: `contract_amount` also becomes `Rupiah` (ARCHITECTURE.md
 * 3.1's Omit-and-compose, same as every other money column in this
 * codebase) -- genuinely nullable only where the view's own LEFT JOIN
 * means so (a project with no contract yet).
 */
export type ClientProjectOverview = Omit<
  Tables<'vw_client_project_overview'>,
  'project_id' | 'organization_id' | 'project_name' | 'status' | 'contract_amount'
> & {
  project_id: string;
  organization_id: string;
  project_name: string;
  status: NonNullable<Tables<'vw_client_project_overview'>['status']>;
  contract_amount: Rupiah | null;
};

export type ClientZoneProgress = Omit<
  Tables<'vw_client_zone_progress'>,
  'zone_id' | 'project_id' | 'zone_name' | 'progress_percent'
> & {
  zone_id: string;
  project_id: string;
  zone_name: string;
  progress_percent: number;
};

export type ClientTimelineEvent = Omit<
  Tables<'vw_client_timeline_event'>,
  'project_id' | 'event_type' | 'source_id' | 'title' | 'event_at' | 'status'
> & {
  project_id: string;
  event_type: string;
  source_id: string;
  title: string;
  event_at: string;
  status: string;
};

/**
 * `thumbnail_path` replaced with a resolved, time-limited signed URL -- the
 * `photos` bucket is private (ADR from Fase 4's migration), so a raw path
 * is not something a browser can load directly.
 */
export type ClientProgressPhoto = Omit<
  Tables<'vw_client_progress_photo'>,
  'photo_id' | 'project_id' | 'zone_id' | 'thumbnail_path' | 'storage_path' | 'created_at' | 'uploaded_by_name'
> & {
  photo_id: string;
  project_id: string;
  zone_id: string;
  created_at: string;
  uploaded_by_name: string;
  thumbnailUrl: string | null;
};
