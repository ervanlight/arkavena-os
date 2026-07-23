import { z } from 'zod';

/**
 * Zod lives at the boundary only (ARCHITECTURE.md 3.3): these validate a
 * server action's raw input. Nothing past that point re-validates the same
 * shape -- once parsed, the domain trusts its own types.
 */

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Nama klien wajib diisi').max(200),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().trim().email('Format email tidak valid').optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const createSiteSchema = z.object({
  clientId: z.string().uuid('Pilih klien'),
  name: z.string().trim().min(1, 'Nama lokasi wajib diisi').max(200),
  address: z.string().trim().max(1000).optional(),
});
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama lokasi wajib diisi').max(200).optional(),
  address: z.string().trim().max(1000).optional(),
});
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

export const createLeadSchema = z.object({
  clientId: z.string().uuid().optional(),
  contactName: z.string().trim().min(1, 'Nama kontak wajib diisi').max(200),
  email: z.string().trim().email('Format email tidak valid').optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  source: z.string().trim().max(200).optional(),
  budgetKnown: z.boolean().optional(),
  desiredStartDate: z.string().date().optional(),
  estimatedValue: z
    .string()
    .trim()
    .regex(/^\d{1,15}$/, 'Nominal harus angka bulat, tanpa titik/koma, maksimal 15 digit')
    .optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'assessment_scheduled',
  'proposal_sent',
  'won',
  'lost',
] as const;

export const updateLeadStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
  lostReason: z.string().trim().min(1).max(2000).optional(),
});
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

/**
 * Either `clientId` (an existing client) or enough to create a new one
 * (`newClientName`) must be provided -- same for the site -- checked with
 * `.refine` rather than left to the database, since this is a boundary
 * input-shape rule, not a business rule (ARCHITECTURE.md 3.3).
 */
export const convertLeadToProjectSchema = z
  .object({
    leadId: z.string().uuid(),
    projectName: z.string().trim().min(1, 'Nama proyek wajib diisi').max(200),
    clientId: z.string().uuid().optional(),
    newClientName: z.string().trim().min(1).max(200).optional(),
    siteId: z.string().uuid().optional(),
    newSiteName: z.string().trim().min(1).max(200).optional(),
    newSiteAddress: z.string().trim().max(1000).optional(),
  })
  .refine((input) => input.clientId !== undefined || input.newClientName !== undefined, {
    message: 'Pilih klien yang sudah ada atau isi nama klien baru',
    path: ['clientId'],
  })
  .refine((input) => input.siteId !== undefined || input.newSiteName !== undefined, {
    message: 'Pilih lokasi yang sudah ada atau isi nama lokasi baru',
    path: ['siteId'],
  });
export type ConvertLeadToProjectInput = z.infer<typeof convertLeadToProjectSchema>;
