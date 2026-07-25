import { z } from 'zod';

export const createHoldPointTemplateSchema = z.object({
  workType: z.string().trim().min(1, 'Jenis pekerjaan wajib diisi').max(100),
  name: z.string().trim().min(1, 'Nama hold point wajib diisi').max(200),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateHoldPointTemplateInput = z.infer<typeof createHoldPointTemplateSchema>;

export const updateHoldPointTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama hold point wajib diisi').max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateHoldPointTemplateInput = z.infer<typeof updateHoldPointTemplateSchema>;

export const createInspectionSchema = z.object({
  projectId: z.string().uuid(),
  workPackageId: z.string().uuid(),
  zoneId: z.string().uuid(),
  holdPointTemplateId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;

export const recordInspectionResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['passed', 'failed']),
  notes: z.string().trim().max(2000).optional(),
});
export type RecordInspectionResultInput = z.infer<typeof recordInspectionResultSchema>;

export const overrideInspectionSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, 'Alasan override wajib diisi'),
});
export type OverrideInspectionInput = z.infer<typeof overrideInspectionSchema>;

export const createNonconformitySchema = z.object({
  inspectionId: z.string().uuid(),
  description: z.string().trim().min(1, 'Keterangan wajib diisi').max(2000),
  severity: z.enum(['low', 'medium', 'high']).optional(),
});
export type CreateNonconformityInput = z.infer<typeof createNonconformitySchema>;

export const resolveNonconformitySchema = z.object({
  id: z.string().uuid(),
});
export type ResolveNonconformityInput = z.infer<typeof resolveNonconformitySchema>;

export const createProjectCompletionSignoffSchema = z.object({
  projectId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateProjectCompletionSignoffInput = z.infer<typeof createProjectCompletionSignoffSchema>;
