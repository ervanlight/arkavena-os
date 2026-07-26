import { z } from 'zod';

/**
 * Unlike every other money field in this codebase (funding_receipts,
 * milestones, contracts, ...), a variation's cost impact may be negative
 * (ADR 0012 decision 4: scope reduction is a cost reduction). The leading
 * sign is optional; the digit count still caps at 15, matching ADR 0008's
 * safe-integer ceiling on the magnitude regardless of sign.
 */
const signedMoneyString = z
  .string()
  .trim()
  .regex(/^-?\d{1,15}$/, 'Nominal harus angka bulat (boleh minus), tanpa titik/koma, maksimal 15 digit');

export const createChangeOrderSchema = z.object({
  projectId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>;

export const setChangeOrderImpactSchema = z.object({
  id: z.string().uuid(),
  costImpactAmount: signedMoneyString,
  scheduleImpactDays: z.number().int(),
});
export type SetChangeOrderImpactInput = z.infer<typeof setChangeOrderImpactSchema>;

/** ADR 0026 §4.2: an optional plain-language sentence, set at the moment this variation is actually sent to the client -- never the raw internal `title`. */
export const sendChangeOrderToClientSchema = z.object({
  id: z.string().uuid(),
  clientSummary: z.string().trim().max(300).optional(),
});
export type SendChangeOrderToClientInput = z.infer<typeof sendChangeOrderToClientSchema>;

export const changeOrderReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, 'Alasan wajib diisi'),
});
export type ChangeOrderReasonInput = z.infer<typeof changeOrderReasonSchema>;
