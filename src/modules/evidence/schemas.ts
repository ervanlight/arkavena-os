import { z } from 'zod';

export const overrideEvidenceGateSchema = z.object({
  workPackageId: z.string().uuid(),
  reason: z.string().trim().min(1, 'Alasan wajib diisi'),
});
export type OverrideEvidenceGateInput = z.infer<typeof overrideEvidenceGateSchema>;
