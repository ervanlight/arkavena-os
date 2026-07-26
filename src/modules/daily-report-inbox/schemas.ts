import { z } from 'zod';

/**
 * Every create schema below requires a caller-supplied `id`, unlike the
 * DB-generated ids most other modules use. This module's rows are the ones
 * D3 (ARCHITECTURE.md §9) commits to creating offline: a site coordinator
 * fills in a daily log with no signal, the mutation sits in the outbox
 * (core/offline) until connectivity returns, and the very same create may
 * be replayed after a network failure mid-sync. A client-generated id
 * (crypto.randomUUID(), available in every evergreen mobile browser) is
 * what makes that replay idempotent -- the repository upserts by id rather
 * than inserting blind, so a retried create updates the same row instead of
 * risking a duplicate. It also lets the UI reference the not-yet-synced
 * entity before the server has ever seen it.
 */

export const createDailyLogSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  logDate: z.string().date(),
  weather: z.string().trim().max(200).optional(),
  manpowerCount: z.number().int().min(0).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export type CreateDailyLogInput = z.infer<typeof createDailyLogSchema>;

export const updateDailyLogSchema = z.object({
  id: z.string().uuid(),
  weather: z.string().trim().max(200).optional(),
  manpowerCount: z.number().int().min(0).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export type UpdateDailyLogInput = z.infer<typeof updateDailyLogSchema>;

export const createProgressEntrySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  dailyLogId: z.string().uuid(),
  workPackageId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateProgressEntryInput = z.infer<typeof createProgressEntrySchema>;

export const updateProgressEntrySchema = z.object({
  id: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type UpdateProgressEntryInput = z.infer<typeof updateProgressEntrySchema>;

/**
 * The photo's bytes are uploaded straight from the browser to the `photos`
 * Storage bucket (RLS on `storage.objects` already scopes that write, per
 * the bucket migration) -- this schema only records the resulting row.
 * `storagePath`/`thumbnailPath` are trusted to already point at real
 * objects; nothing here re-uploads or verifies bytes.
 */
export const createPhotoSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  zoneId: z.string().uuid(),
  workPackageId: z.string().uuid().optional(),
  dailyLogId: z.string().uuid().optional(),
  storagePath: z.string().min(1),
  thumbnailPath: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  caption: z.string().trim().max(500).optional(),
});
export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;

export const updatePhotoSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().trim().max(500).optional(),
  workPackageId: z.string().uuid().optional(),
  dailyLogId: z.string().uuid().optional(),
});
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;

export const createMaterialRequestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  workPackageId: z.string().uuid().optional(),
  itemDescription: z.string().trim().min(1, 'Nama material wajib diisi').max(500),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').max(50),
  neededByDate: z.string().date().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;

export const updateMaterialRequestStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['requested', 'fulfilled', 'cancelled']),
});
export type UpdateMaterialRequestStatusInput = z.infer<typeof updateMaterialRequestStatusSchema>;

export const createIssueSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  workPackageId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Judul masalah wajib diisi').max(300),
  description: z.string().trim().max(5000).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const resolveIssueSchema = z.object({
  id: z.string().uuid(),
});
export type ResolveIssueInput = z.infer<typeof resolveIssueSchema>;
