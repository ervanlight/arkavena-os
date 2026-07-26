/**
 * Public API of modules/field-reporting. The only door other modules and
 * app/ may use to reach daily_logs, progress_entries, photos,
 * material_requests, or issues (ARCHITECTURE.md 1.2) -- one module owns
 * all five tables (ARCHITECTURE.md 1.1).
 */

export type {
  DailyLog,
  DailyLogUpdate,
  Issue,
  IssueUpdate,
  MaterialRequest,
  MaterialRequestUpdate,
  NewDailyLog,
  NewIssue,
  NewMaterialRequest,
  NewPhoto,
  NewProgressEntry,
  Photo,
  PhotoUpdate,
  ProgressEntry,
  ProgressEntryUpdate,
  ProjectPhoto,
} from './types';

export {
  createDailyLogSchema,
  createIssueSchema,
  createMaterialRequestSchema,
  createPhotoSchema,
  createProgressEntrySchema,
  resolveIssueSchema,
  updateDailyLogSchema,
  updateMaterialRequestStatusSchema,
  updatePhotoSchema,
  updateProgressEntrySchema,
  type CreateDailyLogInput,
  type CreateIssueInput,
  type CreateMaterialRequestInput,
  type CreatePhotoInput,
  type CreateProgressEntryInput,
  type ResolveIssueInput,
  type UpdateDailyLogInput,
  type UpdateMaterialRequestStatusInput,
  type UpdatePhotoInput,
  type UpdateProgressEntryInput,
} from './schemas';

export { createDailyLogAction, listDailyLogsForProjectAction, updateDailyLogAction } from './actions/daily-log-actions';
export {
  createProgressEntryAction,
  listProgressEntriesForDailyLogAction,
  updateProgressEntryAction,
} from './actions/progress-entry-actions';
export {
  createPhotoAction,
  listPhotosForProjectAction,
  listProjectPhotosWithUrlsAction,
  updatePhotoAction,
} from './actions/photo-actions';
export {
  createMaterialRequestAction,
  listMaterialRequestsForProjectAction,
  updateMaterialRequestStatusAction,
} from './actions/material-request-actions';
export { createIssueAction, listIssuesForProjectAction, resolveIssueAction } from './actions/issue-actions';
