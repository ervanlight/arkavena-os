import type { Tables } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). */

export type ClientDecision = Tables<'client_decisions'>;

/** The only surface this module reads for portal display (ADR 0016) -- every column here is already client-safe by construction. */
export type ClientProjectOverview = Tables<'vw_client_project_overview'>;
export type ClientZoneProgress = Tables<'vw_client_zone_progress'>;
export type ClientTimelineEvent = Tables<'vw_client_timeline_event'>;
export type ClientProgressPhoto = Tables<'vw_client_progress_photo'>;
