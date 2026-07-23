import { z } from 'zod';

/** Zod only at the boundary (CLAUDE.md 3). Money fields are digit strings, same convention as modules/crm's estimatedValue. */

const rupiahDigits = z.string().trim().regex(/^\d{1,15}$/, 'Nominal harus angka bulat, tanpa titik/koma, maksimal 15 digit');

export const createCostLibraryItemSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(200),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').max(50),
  defaultUnitCost: rupiahDigits,
  category: z.string().trim().max(100).optional(),
});
export type CreateCostLibraryItemInput = z.infer<typeof createCostLibraryItemSchema>;

export const updateCostLibraryItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  defaultUnitCost: rupiahDigits.optional(),
  category: z.string().trim().max(100).optional(),
});
export type UpdateCostLibraryItemInput = z.infer<typeof updateCostLibraryItemSchema>;

export const createEstimateSchema = z.object({
  projectId: z.string().uuid(),
  assessmentId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  notes: z.string().trim().max(5000).optional(),
});
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;

const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'superseded'] as const;

export const updateEstimateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
  status: z.enum(ESTIMATE_STATUSES).optional(),
});
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;

export const setBaselineEstimateSchema = z.object({
  id: z.string().uuid(),
});
export type SetBaselineEstimateInput = z.infer<typeof setBaselineEstimateSchema>;

export const createEstimateItemSchema = z.object({
  estimateId: z.string().uuid(),
  costLibraryId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(500),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').max(50),
  quantity: z.number().positive('Kuantitas harus lebih dari nol'),
  unitCost: rupiahDigits,
  unitPrice: rupiahDigits,
});
export type CreateEstimateItemInput = z.infer<typeof createEstimateItemSchema>;

export const updateEstimateItemSchema = z.object({
  id: z.string().uuid(),
  costLibraryId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(500).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  quantity: z.number().positive('Kuantitas harus lebih dari nol').optional(),
  unitCost: rupiahDigits.optional(),
  unitPrice: rupiahDigits.optional(),
});
export type UpdateEstimateItemInput = z.infer<typeof updateEstimateItemSchema>;

export const createProposalSchema = z.object({
  projectId: z.string().uuid(),
  estimateId: z.string().uuid(),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const sendProposalSchema = z.object({
  id: z.string().uuid(),
});
export type SendProposalInput = z.infer<typeof sendProposalSchema>;

export const decideProposalSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(2000),
});
export type DecideProposalInput = z.infer<typeof decideProposalSchema>;
