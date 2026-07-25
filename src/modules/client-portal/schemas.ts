import { z } from 'zod';

export const publishClientStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['on_track', 'waiting_client_decision', 'external_dependency', 'schedule_adjustment', 'completed']),
  headline: z.string().trim().min(1, 'Ringkasan wajib diisi').max(300),
  detail: z.string().trim().max(2000).optional(),
});
export type PublishClientStatusInput = z.infer<typeof publishClientStatusSchema>;
