import type { Tables, TablesInsert } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). No money column on either table, so no Rupiah override is needed. */

export type Evidence = Tables<'evidence'>;
export type NewEvidence = TablesInsert<'evidence'>;

/**
 * The Client Timeline's own shape: `storage_path`/`thumbnail_path` replaced
 * with a resolved, time-limited signed URL, the same "raw path is not
 * browser-loadable" reasoning as client-portal's ClientProgressPhoto -- the
 * `photos` bucket is private, and every evidence row's paths were copied
 * verbatim from a `photos` row by fn_photos_sync_evidence (ADR 0029
 * Decision 3), so they resolve through that same bucket.
 */
export type EvidenceWithUrl = Omit<Evidence, 'storage_path' | 'thumbnail_path'> & { thumbnailUrl: string | null };

export type EvidenceOverrideRow = Tables<'evidence_overrides'>;

/** The three tables ADR 0029 Decision 3 allows evidence to attach to -- kept as a literal union, not `string`, so a typo can't silently create an orphaned activity_table value. */
export type EvidenceActivityTable = 'work_packages' | 'daily_logs' | 'handover_items';
