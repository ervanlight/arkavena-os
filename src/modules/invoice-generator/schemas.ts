import { z } from 'zod';

/** Same money-at-the-boundary shape every other module's schemas.ts uses (ARCHITECTURE.md 3.1, ADR 0008's safe-integer ceiling). */
const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, 'Nominal harus angka bulat, tanpa titik/koma, maksimal 15 digit');

export const createInvoiceSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  changeOrderId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Judul invoice wajib diisi').max(200),
  amount: moneyString,
  dueDate: z.string().date(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/**
 * No `approvedBy` field -- issuing is Technical-Director-only
 * (fn_invoices_guard_issuance, ADR 0017) and the action sets `approved_by`
 * to the caller's own id, never a client-supplied user id (same reasoning
 * as quality-gate's overrideInspectionSchema never accepting an arbitrary
 * `overriddenBy`).
 */
export const issueInvoiceSchema = z.object({ id: z.string().uuid() });
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;

export const cancelInvoiceSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, 'Alasan pembatalan wajib diisi'),
});
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: moneyString,
  proofPath: z.string().trim().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
