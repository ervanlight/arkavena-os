import Link from 'next/link';
import { listClientDecisionsAction, listPendingClientDecisionsAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';
import { DecisionClockBadge } from '../../decision-clock-badge';

export const metadata = { title: 'Keputusan — BuildTrust OS' };

const DECISION_LABEL_ID: Record<string, string> = {
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export default async function ClientPortalDecisionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [pendingResult, allResult] = await Promise.all([
    listPendingClientDecisionsAction(projectId),
    listClientDecisionsAction(projectId),
  ]);

  const pending = pendingResult.ok ? pendingResult.data : [];
  const pendingIds = new Set(pending.map((d) => d.id));
  const decided = (allResult.ok ? allResult.data : []).filter((d) => !pendingIds.has(d.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Keputusan</h1>
        <PortalNav projectId={projectId} active="/keputusan" />
      </div>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Menunggu keputusan Anda</h2>
        {pending.length === 0 && <p className="mt-2 text-sm text-slate-500">Tidak ada yang menunggu.</p>}
        <ul className="mt-3 divide-y divide-slate-100">
          {pending.map((decision) => (
            <li key={decision.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="flex items-center gap-2">
                <DecisionClockBadge tier={decision.clockTier} />
                <span className="text-slate-600">
                  Sejak {new Date(decision.presented_at).toLocaleDateString('id-ID')}
                </span>
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
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Riwayat</h2>
        {decided.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada riwayat keputusan.</p>}
        <ul className="mt-3 divide-y divide-slate-100">
          {decided.map((decision) => (
            <li key={decision.id} className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-600">
                {decision.decided_at === null ? '—' : new Date(decision.decided_at).toLocaleDateString('id-ID')}
              </span>
              <span className="font-medium text-slate-900">
                {decision.decision === null ? '—' : (DECISION_LABEL_ID[decision.decision] ?? decision.decision)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
