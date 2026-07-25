import { listMyNotificationsAction } from '@/core/notifications';
import { Card, EmptyState, StatusBadge } from '@/core/ui';
import { MarkNotificationReadForm } from './mark-notification-read-form';

export const metadata = { title: 'Notifikasi — Arkavena OS' };

/**
 * F11: the read/mark-read side of the in-app notification loop.
 * syncAttentionNotificationsAction (called from the Command Center dashboard
 * load) is the write side -- this just lists what has already accumulated for
 * the signed-in user, newest first.
 */
export default async function NotificationsPage() {
  const result = await listMyNotificationsAction(undefined);
  const notifications = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Notifikasi</h1>

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && notifications.length === 0 && <EmptyState title="Belum ada notifikasi" />}

      {result.ok && notifications.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                    {new Date(notification.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {notification.read_at === null ? (
                    <MarkNotificationReadForm notificationId={notification.id} />
                  ) : (
                    <StatusBadge tone="neutral">Sudah dibaca</StatusBadge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
