import { z } from 'zod';

/** Zod only at the boundary (CLAUDE.md 3). Money fields are digit strings, same convention as modules/estimating's rupiahDigits. */

const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, 'Nominal harus angka bulat, tanpa titik/koma, maksimal 15 digit');

export const createVendorSchema = z.object({
  name: z.string().trim().min(1, 'Nama vendor wajib diisi').max(200),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().trim().email('Format email tidak valid').optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().trim().email('Format email tidak valid').optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

export const createVendorQuoteSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid(),
  materialRequestId: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(500),
  amount: moneyString,
  validUntil: z.string().date().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateVendorQuoteInput = z.infer<typeof createVendorQuoteSchema>;

const VENDOR_QUOTE_STATUSES = ['received', 'accepted', 'rejected'] as const;

export const updateVendorQuoteSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(VENDOR_QUOTE_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type UpdateVendorQuoteInput = z.infer<typeof updateVendorQuoteSchema>;

export const createPurchaseOrderSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid(),
  vendorQuoteId: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(500),
  amount: moneyString,
  notes: z.string().trim().max(2000).optional(),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const overrideIssuePurchaseOrderSchema = createPurchaseOrderSchema.extend({
  reason: z.string().trim().min(1, 'Alasan override wajib diisi'),
});
export type OverrideIssuePurchaseOrderInput = z.infer<typeof overrideIssuePurchaseOrderSchema>;

export const createDeliverySchema = z.object({
  purchaseOrderId: z.string().uuid(),
  deliveredAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
