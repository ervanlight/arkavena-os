import { listClientTimelineEventsAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';
import { EmptyState } from '@/core/ui';

export const metadata = { title: 'Timeline — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  pending: 'Menunggu',
  completed: 'Selesai',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  menunggu: 'Menunggu keputusan',
};

const EVENT_TYPE_LABEL_ID: Record<string, string> = {
  milestone: 'Termin',
  decision: 'Keputusan',
};

export default async function ClientPortalTimelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const result = await listClientTimelineEventsAction(projectId);
  const events = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Timeline</h1>
        <PortalNav projectId={projectId} active="/timeline" />
      </div>

      {events.length === 0 ? (
        <EmptyState title="Belum ada catatan timeline" />
      ) : (
        <ol className="space-y-3 border-l-2 border-[color:var(--color-hairline)] pl-4">
          {events.map((event) => (
            <li key={`${event.event_type}-${event.source_id}`}>
              <p className="text-xs uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
                {EVENT_TYPE_LABEL_ID[event.event_type] ?? event.event_type} ·{' '}
                {new Date(event.event_at).toLocaleDateString('id-ID')}
              </p>
              <p className="text-sm font-medium text-[color:var(--color-ink)]">{event.title}</p>
              <p className="text-xs text-[color:var(--color-ink-tertiary)]">{STATUS_LABEL_ID[event.status] ?? event.status}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
