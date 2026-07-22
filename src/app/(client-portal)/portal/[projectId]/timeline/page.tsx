import { listClientTimelineEventsAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';

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
        <h1 className="text-lg font-semibold text-slate-900">Timeline</h1>
        <PortalNav projectId={projectId} active="/timeline" />
      </div>

      {events.length === 0 && <p className="text-sm text-slate-500">Belum ada catatan timeline.</p>}

      <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
        {events.map((event) => (
          <li key={`${event.event_type}-${event.source_id}`}>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {EVENT_TYPE_LABEL_ID[event.event_type] ?? event.event_type} ·{' '}
              {new Date(event.event_at).toLocaleDateString('id-ID')}
            </p>
            <p className="text-sm font-medium text-slate-900">{event.title}</p>
            <p className="text-xs text-slate-500">{STATUS_LABEL_ID[event.status] ?? event.status}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
