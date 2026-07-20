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
