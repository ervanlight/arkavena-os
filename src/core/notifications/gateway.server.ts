import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NOTIFICATION_STATUS } from '@/core/db/enums';
import { NotFoundError } from '@/core/errors/app-error';
import type { Notification } from './types';

/**
 * All direct `notifications` table access lives here (ARCHITECTURE.md 1.2's
 * one-table-one-owner rule, applied to a core-level table the same way
 * core/audit owns `audit_logs`).
 */

export async function listNotificationsForUser(
  supabase: ServerSupabase,
  userId: string,
  limit = 30,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error !== null) throw error;
  return data;
}

export async function markNotificationRead(supabase: ServerSupabase, id: string): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: NOTIFICATION_STATUS.READ, read_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Notification ${id} not found`, { meta: { notificationId: id } });
  }
  return data;
}

/**
 * Whether an unread in-app notification with this exact (user, entity_table,
 * entity_id) already exists -- the idempotency check that keeps
 * syncAttentionNotifications from re-inserting the same "still overdue" item
 * on every dashboard load, the same "never re-fires while the condition
 * persists" shape the DB sync triggers elsewhere in this codebase already
 * follow (e.g. fn_projects_sync_warranties_on_completion).
 */
export async function hasUnreadNotification(
  supabase: ServerSupabase,
  params: { userId: string; entityTable: string; entityId: string | null },
): Promise<boolean> {
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.userId)
    .eq('entity_table', params.entityTable)
    .is('read_at', null);

  query = params.entityId !== null ? query.eq('entity_id', params.entityId) : query.is('entity_id', null);

  const { count, error } = await query;
  if (error !== null) throw error;
  return (count ?? 0) > 0;
}

export async function insertNotification(
  supabase: ServerSupabase,
  input: {
    organizationId: string;
    userId: string;
    title: string;
    body: string | null;
    entityTable: string;
    entityId: string | null;
  },
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      channel: 'in_app',
      status: NOTIFICATION_STATUS.SENT,
      title: input.title,
      body: input.body,
      entity_table: input.entityTable,
      entity_id: input.entityId,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error !== null) throw error;
  return data;
}
