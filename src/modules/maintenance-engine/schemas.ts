import { z } from 'zod';

/** Zod only at the boundary (CLAUDE.md 3). No money field anywhere in this module (ADR 0019). */

export const createHandoverItemSchema = z.object({
  projectId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  itemType: z.string().trim().min(1, 'Jenis item wajib diisi').max(100),
  description: z.string().trim().max(2000).optional(),
  handedOverAt: z.string().datetime().optional(),
  handedOverTo: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateHandoverItemInput = z.infer<typeof createHandoverItemSchema>;

export const createWarrantySchema = z.object({
  projectId: z.string().uuid(),
  handoverItemId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  startsAt: z.string().date(),
  endsAt: z.string().date(),
  terms: z.string().trim().max(2000).optional(),
});
export type CreateWarrantyInput = z.infer<typeof createWarrantySchema>;

const WARRANTY_STATUSES = ['active', 'expired', 'claimed'] as const;

export const updateWarrantySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(WARRANTY_STATUSES).optional(),
  endsAt: z.string().date().optional(),
  terms: z.string().trim().max(2000).optional(),
});
export type UpdateWarrantyInput = z.infer<typeof updateWarrantySchema>;

export const createAssetSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama aset wajib diisi').max(200),
  category: z.string().trim().max(100).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(200).optional(),
  installDate: z.string().date().optional(),
  warrantyId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().max(100).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(200).optional(),
  installDate: z.string().date().optional(),
  warrantyId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

export const createMaintenancePlanSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  intervalDays: z.number().int().positive('Interval harus lebih dari nol hari'),
  startsAt: z.string().date(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateMaintenancePlanInput = z.infer<typeof createMaintenancePlanSchema>;

export const updateMaintenancePlanSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  intervalDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type UpdateMaintenancePlanInput = z.infer<typeof updateMaintenancePlanSchema>;

export const markMaintenancePlanCompletedSchema = z.object({
  id: z.string().uuid(),
});
export type MarkMaintenancePlanCompletedInput = z.infer<typeof markMaintenancePlanCompletedSchema>;

export const createServiceTicketSchema = z.object({
  assetId: z.string().uuid(),
  warrantyId: z.string().uuid().optional(),
  maintenancePlanId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  description: z.string().trim().max(2000).optional(),
  assignedTo: z.string().uuid().optional(),
});
export type CreateServiceTicketInput = z.infer<typeof createServiceTicketSchema>;

const SERVICE_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'cancelled'] as const;

export const updateServiceTicketStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(SERVICE_TICKET_STATUSES),
  resolutionNotes: z.string().trim().max(2000).optional(),
});
export type UpdateServiceTicketStatusInput = z.infer<typeof updateServiceTicketStatusSchema>;
