import Link from 'next/link';
import { listClientDecisionsAction, listPendingClientDecisionsAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';
import { DecisionClockBadge } from '../../decision-clock-badge';
import { Card, EmptyState } from '@/core/ui';

export const metadata = { title: 'Keputusan — Arkavena OS' };

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
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Keputusan</h1>
        <PortalNav projectId={projectId} active="/keputusan" />
      </div>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Menunggu keputusan Anda</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Tidak ada yang menunggu.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {pending.map((decision) => (
              <li key={decision.id} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
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
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[color:var(--color-accent-hover)]"
                  >
                    Lihat &amp; putuskan
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Riwayat</h2>
        {decided.length === 0 ? (
          <EmptyState title="Belum ada riwayat keputusan" />
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {decided.map((decision) => (
              <li key={decision.id} className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0">
                <span className="text-[color:var(--color-ink-secondary)]">
                  {decision.decided_at === null ? '—' : new Date(decision.decided_at).toLocaleDateString('id-ID')}
                </span>
                <span className="font-medium text-[color:var(--color-ink)]">
                  {decision.decision === null ? '—' : (DECISION_LABEL_ID[decision.decision] ?? decision.decision)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
