'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  hasUnreadNotification,
  insertNotification,
  listNotificationsForUser,
  markNotificationRead,
} from './gateway.server';
import { markNotificationReadSchema, syncAttentionNotificationsSchema } from './schemas';
import type { Notification } from './types';

export const listMyNotificationsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'notification', action: 'view' },
    loadContext: getActionContext,
    name: 'notifications.listMyNotifications',
  },
  async (_input, ctx): Promise<Notification[]> => {
    const supabase = await createServerSupabase();
    return listNotificationsForUser(supabase, ctx.userId);
  },
);

/**
 * The recipient's own edit: `notifications_update_own` RLS lets it through,
 * `fn_notifications_guard_recipient_edits` (the migration) is the real,
 * unbypassable restriction limiting it to read_at/status only.
 */
export const markNotificationReadAction = safeAction(
  {
    schema: markNotificationReadSchema,
    permission: { resource: 'notification', action: 'mark_read' },
    loadContext: getActionContext,
    name: 'notifications.markNotificationRead',
  },
  async (id): Promise<Notification> => {
    const supabase = await createServerSupabase();
    return markNotificationRead(supabase, id);
  },
);

/**
 * F11: no cron exists anywhere in this stack (ADR 0019 §5) -- "computed on
 * read" is the standing pattern for anything time-based, so there is no
 * trigger point that could insert these rows on its own. This is called
 * instead from an existing read a staff member already performs (the Command
 * Center dashboard load), turning whatever it already aggregated into
 * persistent, markable-read `notifications` rows for the viewer -- in_app
 * channel only, no new external channel (owner decision D4/D9). Idempotent
 * per (user, entity_table, entity_id): an item already open and unread is
 * left alone, never duplicated.
 */
export const syncAttentionNotificationsAction = safeAction(
  {
    schema: syncAttentionNotificationsSchema,
    permission: { resource: 'notification', action: 'view' },
    loadContext: getActionContext,
    name: 'notifications.syncAttentionNotifications',
  },
  async (items, ctx): Promise<void> => {
    const supabase = await createServerSupabase();
    for (const item of items) {
      const alreadyOpen = await hasUnreadNotification(supabase, {
        userId: ctx.userId,
        entityTable: item.entityTable,
        entityId: item.entityId,
      });
      if (alreadyOpen) continue;

      await insertNotification(supabase, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title: item.title,
        body: item.body,
        entityTable: item.entityTable,
        entityId: item.entityId,
      });
    }
  },
);
