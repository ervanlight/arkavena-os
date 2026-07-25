import { formatRp } from '@/core/money/rupiah';
import {
  getClientProjectOverviewAction,
  listClientTimelineEventsAction,
  listClientZoneProgressAction,
} from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';
import { Card } from '@/core/ui';

export const metadata = { title: 'Laporan Mingguan — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const EVENT_TYPE_LABEL_ID: Record<string, string> = {
  milestone: 'Termin',
  decision: 'Keputusan',
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generated on request, straight from the same vw_client_* views every
 * other portal page already reads -- no separate report table, no
 * hand-entered content (ADR 0016 SS4, the "tanpa tulis ulang" exit
 * criterion). A print-to-PDF button costs nothing extra to add later if
 * the owner wants one at CHECKPOINT #4; not built now since nothing in
 * ARCHITECTURE.md asks for it yet.
 */
export default async function ClientPortalWeeklyReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [overviewResult, zonesResult, timelineResult] = await Promise.all([
    getClientProjectOverviewAction(projectId),
    listClientZoneProgressAction(projectId),
    listClientTimelineEventsAction(projectId),
  ]);

  const overview = overviewResult.ok ? overviewResult.data : null;
  const zones = zonesResult.ok ? zonesResult.data : [];
  const weekAgo = Date.now() - ONE_WEEK_MS;
  const eventsThisWeek = (timelineResult.ok ? timelineResult.data : []).filter(
    (event) => new Date(event.event_at).getTime() >= weekAgo,
  );

  const today = new Date();
  const weekStart = new Date(today.getTime() - ONE_WEEK_MS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Laporan Mingguan</h1>
        <p className="text-sm text-[color:var(--color-ink-tertiary)]">
          {weekStart.toLocaleDateString('id-ID')} &ndash; {today.toLocaleDateString('id-ID')}
        </p>
        <PortalNav projectId={projectId} active="/laporan-mingguan" />
      </div>

      {overview === null ? (
        <p className="text-sm text-[color:var(--color-ink-secondary)]">Proyek tidak ditemukan.</p>
      ) : (
        <>
          <Card>
            <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">{overview.project_name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[color:var(--color-ink-tertiary)]">Status</dt>
                <dd className="font-medium text-[color:var(--color-ink)]">{STATUS_LABEL_ID[overview.status] ?? overview.status}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-ink-tertiary)]">Target selesai</dt>
                <dd className="font-medium text-[color:var(--color-ink)]">{overview.target_end_date ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-ink-tertiary)]">Nilai kontrak</dt>
                <dd className="font-medium text-[color:var(--color-ink)]">
                  {overview.contract_amount === null ? '—' : formatRp(overview.contract_amount)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Progres per zona</h2>
            <ul className="mt-3 space-y-3">
              {zones.map((zone) => (
                <li key={zone.zone_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[color:var(--color-ink)]">{zone.zone_name}</span>
                    <span className="text-[color:var(--color-ink-tertiary)]">{zone.progress_percent}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[color:var(--color-surface-secondary)]">
                    <div
                      className="h-2 rounded-full bg-[color:var(--color-success)]"
                      style={{ width: `${zone.progress_percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Kejadian minggu ini</h2>
            {eventsThisWeek.length === 0 && (
              <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Tidak ada kejadian dalam 7 hari terakhir.</p>
            )}
            <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
              {eventsThisWeek.map((event) => (
                <li key={`${event.event_type}-${event.source_id}`} className="py-2 text-sm first:pt-0 last:pb-0">
                  <p className="text-xs uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
                    {EVENT_TYPE_LABEL_ID[event.event_type] ?? event.event_type} ·{' '}
                    {new Date(event.event_at).toLocaleDateString('id-ID')}
                  </p>
                  <p className="font-medium text-[color:var(--color-ink)]">{event.title}</p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
