import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatRp } from '@/core/money/rupiah';
import {
  getClientProjectOverviewAction,
  listClientZoneProgressAction,
  listPendingClientDecisionsAction,
} from '@/modules/client-portal';
import { PortalNav } from '../portal-nav';
import { DecisionClockBadge } from '../decision-clock-badge';

export const metadata = { title: 'Ringkasan Proyek — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
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
      <p role="alert" className="text-sm text-red-600">
        {overviewResult.error.message}
      </p>
    );
  }
  const overview = overviewResult.data;
  if (overview === null) notFound();

  const zones = zonesResult.ok ? zonesResult.data : [];
  const pendingDecisions = decisionsResult.ok ? decisionsResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{overview.project_name}</h1>
        <PortalNav projectId={projectId} active="" />
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-slate-900">
              {STATUS_LABEL_ID[overview.status] ?? overview.status}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Mulai</dt>
            <dd className="font-medium text-slate-900">{overview.start_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Target selesai</dt>
            <dd className="font-medium text-slate-900">{overview.target_end_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Nilai kontrak</dt>
            <dd className="font-medium text-slate-900">
              {overview.contract_amount === null ? '—' : formatRp(overview.contract_amount)}
            </dd>
          </div>
        </dl>
      </div>

      {pendingDecisions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-sm font-semibold text-amber-900">Menunggu keputusan Anda</h2>
          <ul className="mt-3 space-y-2">
            {pendingDecisions.map((decision) => (
              <li key={decision.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <DecisionClockBadge tier={decision.clockTier} />
                  <span className="text-amber-900">Sejak {new Date(decision.presented_at).toLocaleDateString('id-ID')}</span>
                </div>
                {decision.change_order_id !== null && (
                  <Link
                    href={`/variations/${decision.change_order_id}/approve`}
                    className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    Lihat &amp; putuskan
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Progres per zona</h2>
        {zones.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada zona.</p>}
        <ul className="mt-3 space-y-3">
          {zones.map((zone) => (
            <li key={zone.zone_id}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-900">{zone.zone_name}</span>
                <span className="text-slate-500">{zone.progress_percent}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-600"
                  style={{ width: `${zone.progress_percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
