import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getClientProjectOverviewAction,
  listClientTimelineEventsAction,
  listClientStatusUpdatesForProjectAction,
  listPendingClientDecisionsAction,
} from '@/modules/client-portal';
import { listClientVisibleEvidenceWithUrlsForProjectAction } from '@/modules/evidence';
import { listProposalsForProjectAction } from '@/modules/estimating';
import { listInvoicesForProjectAction } from '@/modules/billing';
import { formatRp } from '@/core/money/rupiah';
import { Card, EmptyState } from '@/core/ui';
import { PortalNav } from '../portal-nav';
import { DecisionClockBadge } from '../decision-clock-badge';

export const metadata = { title: 'Beranda — Arkavena OS' };

/**
 * ADR 0026 §4.1: replaces the old Ringkasan/Timeline/Zona/Foto/Keputusan
 * tabs with one scrolling home -- Status / Menunggu Anda / Hari Ini / Minggu
 * Ini / Akan Datang / Update Terbaru. No percentage progress bar, no open-
 * issue counts, no cash ratios (§4.3): every section here is a plain
 * sentence a client can read cold. laporan-mingguan is untouched -- ADR
 * 0026 names exactly those five tabs as replaced, not that one.
 */

const CLIENT_STATUS_LABEL_ID: Record<string, string> = {
  on_track: 'Berjalan sesuai rencana',
  waiting_client_decision: 'Menunggu keputusan Anda',
  external_dependency: 'Menunggu pihak luar',
  schedule_adjustment: 'Ada penyesuaian jadwal',
  completed: 'Selesai',
};

const CLIENT_STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  on_track: 'success',
  waiting_client_decision: 'warning',
  external_dependency: 'warning',
  schedule_adjustment: 'info',
  completed: 'success',
};

const TIMELINE_EVENT_LABEL_ID: Record<string, string> = {
  milestone: 'Termin',
  decision: 'Keputusan',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** ADR 0026 §4.2: "tanpa tanggal pasti kalau berisiko meleset" -- a relative window, not a date that can read as a broken promise. */
function relativeUpcomingLabel(eventAt: string, now: number): string {
  const daysAway = Math.ceil((new Date(eventAt).getTime() - now) / DAY_MS);
  if (daysAway <= 7) return 'minggu ini';
  if (daysAway <= 14) return 'minggu depan';
  return 'beberapa minggu lagi';
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type FeedItem = { key: string; at: string; label: string; text: string };

export default async function ClientPortalHomePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [overviewResult, statusResult, pendingResult, evidenceResult, timelineResult, proposalsResult, invoicesResult] =
    await Promise.all([
      getClientProjectOverviewAction(projectId),
      listClientStatusUpdatesForProjectAction(projectId),
      listPendingClientDecisionsAction(projectId),
      listClientVisibleEvidenceWithUrlsForProjectAction(projectId),
      listClientTimelineEventsAction(projectId),
      listProposalsForProjectAction(projectId),
      listInvoicesForProjectAction(projectId),
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

  const statusHistory = statusResult.ok ? statusResult.data : [];
  const latestStatus = statusHistory[0] ?? null;
  const pendingDecisions = pendingResult.ok ? pendingResult.data : [];
  const evidence = evidenceResult.ok ? evidenceResult.data : [];
  const timelineEvents = timelineResult.ok ? timelineResult.data : [];
  // ADR 0026 §5 amendment (F1): the client's own proposal accept/decline.
  const pendingProposals = (proposalsResult.ok ? proposalsResult.data : []).filter((p) => p.status === 'sent');
  // ADR 0026 §5: "ada tagihan yang perlu dibayar, jatuh tempo tanggal X" is
  // the one billing slice allowed onto the Timeline, as a plain notification
  // -- never the aging dashboard/DSO analytics (F3, milestone 2.4).
  const invoicesDue = (invoicesResult.ok ? invoicesResult.data : []).filter((inv) => inv.status === 'issued');
  const hasPendingActions = pendingDecisions.length > 0 || pendingProposals.length > 0 || invoicesDue.length > 0;

  const now = Date.now();
  const today = new Date(now);
  const weekAgo = now - 7 * DAY_MS;

  const evidenceToday = evidence.filter((e) => isSameCalendarDay(new Date(e.captured_at), today));
  const evidenceThisWeek = evidence.filter((e) => new Date(e.captured_at).getTime() >= weekAgo);
  const statusThisWeek = statusHistory.filter((s) => new Date(s.published_at).getTime() >= weekAgo);

  const upcomingMilestones = timelineEvents
    .filter((e) => e.event_type === 'milestone' && e.status !== 'completed' && new Date(e.event_at).getTime() >= now)
    .sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime())
    .slice(0, 5);

  const recentFeed: FeedItem[] = [
    ...timelineEvents.map((e) => ({
      key: `${e.event_type}-${e.source_id}`,
      at: e.event_at,
      label: TIMELINE_EVENT_LABEL_ID[e.event_type] ?? e.event_type,
      text: e.title,
    })),
    ...evidence.map((e) => ({
      key: `evidence-${e.id}`,
      at: e.captured_at,
      label: 'Bukti progres',
      text: 'Foto/bukti baru diunggah',
    })),
    ...statusHistory.map((s) => ({
      key: `status-${s.id}`,
      at: s.published_at,
      label: 'Status proyek',
      text: s.headline,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-[26px] font-bold tracking-tight text-[color:var(--color-ink)]">{overview.project_name}</h1>
        <PortalNav projectId={projectId} active="" />
      </div>

      {/* Status -- always at top, one or two sentences (ADR 0026 §2/§4.1). */}
      <Card className="border border-[color:var(--color-hairline)]">
        {latestStatus === null ? (
          <p className="text-sm text-[color:var(--color-ink-secondary)]">Belum ada pembaruan status untuk proyek ini.</p>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">{latestStatus.headline}</p>
              {latestStatus.detail !== null && (
                <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">{latestStatus.detail}</p>
              )}
              <p className="mt-2 text-xs text-[color:var(--color-ink-tertiary)]">
                {new Date(latestStatus.published_at).toLocaleDateString('id-ID')}
              </p>
            </div>
            <span className="shrink-0">
              {(() => {
                const tone = CLIENT_STATUS_TONE[latestStatus.status] ?? 'neutral';
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      tone === 'success'
                        ? 'bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]'
                        : tone === 'warning'
                          ? 'bg-[color:var(--color-warning)]/14 text-[#a05a00]'
                          : tone === 'info'
                            ? 'bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent-hover)]'
                            : 'bg-[color:var(--color-ink-tertiary)]/12 text-[color:var(--color-ink-secondary)]'
                    }`}
                  >
                    {CLIENT_STATUS_LABEL_ID[latestStatus.status] ?? latestStatus.status}
                  </span>
                );
              })()}
            </span>
          </div>
        )}
      </Card>

      {/* Menunggu Anda */}
      {hasPendingActions && (
        <Card className="border border-[color:var(--color-warning)]/25 bg-[color:var(--color-warning)]/8">
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Menunggu Anda</h2>
          <ul className="mt-3 space-y-2.5">
            {pendingDecisions.map((decision) => (
              <li key={`decision-${decision.id}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <DecisionClockBadge tier={decision.clockTier} />
                  <span className="text-[color:var(--color-ink-secondary)]">
                    {decision.client_summary ?? 'Ada keputusan yang menunggu konfirmasi Anda'}
                  </span>
                </div>
                {decision.change_order_id !== null && (
                  <Link
                    href={`/variations/${decision.change_order_id}/approve`}
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-accent-hover)]"
                  >
                    Lihat &amp; putuskan
                  </Link>
                )}
              </li>
            ))}
            {pendingProposals.map((proposal) => (
              <li key={`proposal-${proposal.id}`} className="flex items-center justify-between gap-3">
                <span className="text-sm text-[color:var(--color-ink-secondary)]">
                  {proposal.client_summary ?? 'Ada proposal yang menunggu keputusan Anda'}
                </span>
                <Link
                  href={`/proposals/${proposal.id}/decide`}
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-accent-hover)]"
                >
                  Lihat &amp; putuskan
                </Link>
              </li>
            ))}
            {invoicesDue.map((invoice) => (
              <li key={`invoice-${invoice.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[color:var(--color-ink-secondary)]">
                  Ada tagihan {formatRp(invoice.amount)} yang perlu dibayar, jatuh tempo{' '}
                  {new Date(invoice.due_date).toLocaleDateString('id-ID')}.
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Hari Ini */}
      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Hari Ini</h2>
        {evidenceToday.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada pembaruan hari ini.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {evidenceToday.map((e) => (
              <div key={e.id} className="aspect-square overflow-hidden rounded-[var(--radius-control)] bg-[color:var(--color-surface-secondary)]">
                {e.thumbnailUrl !== null && (
                  <img src={e.thumbnailUrl} alt="Bukti progres hari ini" className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Minggu Ini */}
      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Minggu Ini</h2>
        {evidenceThisWeek.length === 0 && statusThisWeek.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada catatan minggu ini.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--color-ink-secondary)]">
            {evidenceThisWeek.length > 0 && <li>{evidenceThisWeek.length} bukti progres baru minggu ini.</li>}
            {statusThisWeek.map((s) => (
              <li key={s.id}>{s.headline}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Akan Datang */}
      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Akan Datang</h2>
        {upcomingMilestones.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Tidak ada jadwal yang akan datang.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcomingMilestones.map((m) => (
              <li key={m.source_id} className="flex items-center justify-between text-sm">
                <span className="text-[color:var(--color-ink)]">{m.title}</span>
                <span className="text-[color:var(--color-ink-tertiary)]">{relativeUpcomingLabel(m.event_at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Update Terbaru */}
      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Update Terbaru</h2>
        {recentFeed.length === 0 ? (
          <EmptyState title="Belum ada pembaruan" />
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-[color:var(--color-hairline)] pl-4">
            {recentFeed.map((item) => (
              <li key={item.key}>
                <p className="text-xs uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
                  {item.label} · {new Date(item.at).toLocaleDateString('id-ID')}
                </p>
                <p className="text-sm font-medium text-[color:var(--color-ink)]">{item.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
