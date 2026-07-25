import { z } from 'zod';

export const markNotificationReadSchema = z.string().uuid();
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

/**
 * One "needs attention" fact a caller already computed (Decision Clock
 * overdue, invoice aging overdue, an open high-severity issue, a red/overdue
 * Cash Gate, ...) -- this module never computes any of that itself, only
 * turns it into a persistent, markable-read `notifications` row (F11).
 */
export const attentionItemSchema = z.object({
  entityTable: z.string().trim().min(1).max(100),
  entityId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).nullable(),
});
export type AttentionItemInput = z.infer<typeof attentionItemSchema>;

export const syncAttentionNotificationsSchema = z.array(attentionItemSchema).max(100);
export type SyncAttentionNotificationsInput = z.infer<typeof syncAttentionNotificationsSchema>;
