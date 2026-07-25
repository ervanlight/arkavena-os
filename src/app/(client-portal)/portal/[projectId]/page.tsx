import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatRp } from '@/core/money/rupiah';
import {
  getClientProjectOverviewAction,
  listClientZoneProgressAction,
  listPendingClientDecisionsAction,
} from '@/modules/client-portal';
import { Card, StatusBadge } from '@/core/ui';
import { PortalNav } from '../portal-nav';
import { DecisionClockBadge } from '../decision-clock-badge';

export const metadata = { title: 'Ringkasan Proyek — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  planning: 'neutral',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

export default async function ClientPortalOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [overviewResult, zonesResult, decisionsResult] = await Promise.all([
    getClientProjectOverviewAction(projectId),
    listClientZoneProgressAction(projectId),
    listPendingClientDecisionsAction(projectId),
  ]);

  if (!overviewResult.ok) {
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {overviewResult.error.message}
      </p>
    );
  }
  const overview = overviewResult.data;
  if (overview === null) notFound();

  const zones = zonesResult.ok ? zonesResult.data : [];
  const pendingDecisions = decisionsResult.ok ? decisionsResult.data : [];
  const overallProgress =
    zones.length > 0 ? Math.round(zones.reduce((sum, z) => sum + z.progress_percent, 0) / zones.length) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-[26px] font-bold tracking-tight text-[color:var(--color-ink)]">{overview.project_name}</h1>
        <PortalNav projectId={projectId} active="" />
      </div>

      {/* Hero card -- the single most important thing a client wants at a glance: how far along is my building. */}
      <div className="rounded-[var(--radius-sheet)] bg-[color:var(--color-ink)] p-6 text-white shadow-[var(--shadow-sheet)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/60">Progres keseluruhan</p>
            <p className="mt-1 text-[40px] font-bold leading-none">{overallProgress}%</p>
          </div>
          <StatusBadge tone={STATUS_TONE[overview.status] ?? 'neutral'}>
            {STATUS_LABEL_ID[overview.status] ?? overview.status}
          </StatusBadge>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Mulai</p>
          <p className="mt-1 text-[15px] font-semibold text-[color:var(--color-ink)]">{overview.start_date ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Target selesai</p>
          <p className="mt-1 text-[15px] font-semibold text-[color:var(--color-ink)]">{overview.target_end_date ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Nilai kontrak</p>
          <p className="mt-1 text-[15px] font-semibold text-[color:var(--color-ink)]">
            {overview.contract_amount === null ? '—' : formatRp(overview.contract_amount)}
          </p>
        </Card>
      </div>

      {pendingDecisions.length > 0 && (
        <Card className="border border-[color:var(--color-warning)]/25 bg-[color:var(--color-warning)]/8">
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Menunggu keputusan Anda</h2>
          <ul className="mt-3 space-y-2.5">
            {pendingDecisions.map((decision) => (
              <li key={decision.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <DecisionClockBadge tier={decision.clockTier} />
                  <span className="text-[color:var(--color-ink-secondary)]">
                    Sejak {new Date(decision.presented_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
                {decision.change_order_id !== null && (
                  // A styled Link, not a <Button> nested inside it -- an anchor
                  // wrapping a <button> is invalid HTML (nested interactive
                  // content) and some engines silently mis-render it.
                  <Link
                    href={`/variations/${decision.change_order_id}/approve`}
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-accent-hover)]"
                  >
                    Lihat &amp; putuskan
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Progres per zona</h2>
        {zones.length === 0 && <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada zona.</p>}
        <ul className="mt-3 space-y-4">
          {zones.map((zone) => (
            <li key={zone.zone_id}>
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="font-medium text-[color:var(--color-ink)]">{zone.zone_name}</span>
                <span className="text-[color:var(--color-ink-tertiary)]">{zone.progress_percent}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-secondary)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-success)] transition-all"
                  style={{ width: `${zone.progress_percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
