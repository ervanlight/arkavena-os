import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). No money columns on any of these five tables, so no Rupiah override is needed. */

export type DailyLog = Tables<'daily_logs'>;
export type NewDailyLog = TablesInsert<'daily_logs'>;
export type DailyLogUpdate = TablesUpdate<'daily_logs'>;

export type ProgressEntry = Tables<'progress_entries'>;
export type NewProgressEntry = TablesInsert<'progress_entries'>;
export type ProgressEntryUpdate = TablesUpdate<'progress_entries'>;

export type Photo = Tables<'photos'>;
export type NewPhoto = TablesInsert<'photos'>;
export type PhotoUpdate = TablesUpdate<'photos'>;

export type MaterialRequest = Tables<'material_requests'>;
export type NewMaterialRequest = TablesInsert<'material_requests'>;
export type MaterialRequestUpdate = TablesUpdate<'material_requests'>;

export type Issue = Tables<'issues'>;
export type NewIssue = TablesInsert<'issues'>;
export type IssueUpdate = TablesUpdate<'issues'>;
