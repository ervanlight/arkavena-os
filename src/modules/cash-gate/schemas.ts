import { z } from 'zod';

/**
 * A money field as the boundary sees it -- digits only, capped at 15 digits,
 * which is exactly ADR 0008's safe-integer ceiling (999_999_999_999_999, the
 * largest possible 15-digit value). Same as modules/projects/schemas.ts's
 * moneyString.
 */
const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, 'Nominal harus angka bulat, tanpa titik/koma, maksimal 15 digit');

export const createFundingReceiptSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  amount: moneyString,
  expectedDate: z.string().date(),
});
export type CreateFundingReceiptInput = z.infer<typeof createFundingReceiptSchema>;

export const markFundingReceiptClearedSchema = z.object({
  id: z.string().uuid(),
  proofPath: z.string().trim().max(1000).optional(),
});
export type MarkFundingReceiptClearedInput = z.infer<typeof markFundingReceiptClearedSchema>;

export const createCashForecastSchema = z.object({
  projectId: z.string().uuid(),
  workPackageId: z.string().uuid().optional(),
  amount: moneyString,
  neededByDate: z.string().date(),
});
export type CreateCashForecastInput = z.infer<typeof createCashForecastSchema>;

/**
 * Owner/Finance sets this manually per project; there is no computed default
 * beyond the table's own `0`. Lives here, not modules/projects, since ADR
 * 0011 moved risk_reserve_amount to its own table owned by modules/cash-gate.
 */
export const setRiskReserveSchema = z.object({
  projectId: z.string().uuid(),
  riskReserveAmount: moneyString,
});
export type SetRiskReserveInput = z.infer<typeof setRiskReserveSchema>;

export const overrideOpenWorkPackageSchema = z.object({
  workPackageId: z.string().uuid(),
  reason: z.string().trim().min(1, 'Alasan override wajib diisi'),
});
export type OverrideOpenWorkPackageInput = z.infer<typeof overrideOpenWorkPackageSchema>;
