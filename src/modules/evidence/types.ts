import type { Tables, TablesInsert } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). No money column on either table, so no Rupiah override is needed. */

export type Evidence = Tables<'evidence'>;
export type NewEvidence = TablesInsert<'evidence'>;

export type EvidenceOverrideRow = Tables<'evidence_overrides'>;

/** The three tables ADR 0029 Decision 3 allows evidence to attach to -- kept as a literal union, not `string`, so a typo can't silently create an orphaned activity_table value. */
export type EvidenceActivityTable = 'work_packages' | 'daily_logs' | 'handover_items';
