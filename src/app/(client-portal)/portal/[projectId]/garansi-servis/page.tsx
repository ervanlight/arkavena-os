import { listAssetsForClientAction, listServiceTicketsForClientAction, listWarrantiesForProjectAction } from '@/modules/maintenance-engine';
import { Card, StatusBadge } from '@/core/ui';
import { PortalNav } from '../../portal-nav';
import { ReportServiceTicketForm } from './report-service-ticket-form';

export const metadata = { title: 'Garansi & Servis — Arkavena OS' };

/**
 * Phase 3 (F4): client-facing warranty status + service-ticket visibility,
 * plus a client-originated report path (WORKFLOW_REVIEW.md 8.2's "duplicate
 * entry" gap -- client calls the office, staff re-keys it). Not part of the
 * six-section Client Timeline shell (ADR 0026 §4.1's structure is fixed) --
 * a separate tab, the same way Laporan Mingguan already is.
 *
 * maintenance-engine is not one of the two modules ARCHITECTURE.md 1.2
 * (F25) forbids client-portal from importing directly (only cash-gate/
 * estimating are) -- this page reads it directly, the same shape
 * modules/billing's invoice visibility (F3) already uses.
 */

const WARRANTY_STATUS_LABEL_ID: Record<string, string> = {
  active: 'Aktif',
  expired: 'Sudah habis masa berlaku',
  claimed: 'Sudah diklaim',
};

const WARRANTY_STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  expired: 'neutral',
  claimed: 'warning',
};

const SERVICE_TICKET_STATUS_LABEL_ID: Record<string, string> = {
  open: 'Baru dilaporkan',
  in_progress: 'Sedang dikerjakan',
  resolved: 'Selesai',
  cancelled: 'Dibatalkan',
};

const SERVICE_TICKET_STATUS_TONE: Record<string, 'info' | 'warning' | 'success' | 'neutral'> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  cancelled: 'neutral',
};

export default async function GaransiServisPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [warrantiesResult, assetsResult, ticketsResult] = await Promise.all([
    listWarrantiesForProjectAction(projectId),
    listAssetsForClientAction(projectId),
    listServiceTicketsForClientAction(projectId),
  ]);

  const warranties = warrantiesResult.ok ? warrantiesResult.data : [];
  const assets = assetsResult.ok ? assetsResult.data : [];
  const tickets = ticketsResult.ok ? ticketsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-[26px] font-bold tracking-tight text-[color:var(--color-ink)]">Garansi &amp; Servis</h1>
        <PortalNav projectId={projectId} active="/garansi-servis" />
      </div>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Garansi</h2>
        {warranties.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada garansi tercatat untuk proyek ini.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {warranties.map((warranty) => (
              <li key={warranty.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-ink)]">{warranty.title}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Berlaku sampai {new Date(warranty.ends_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <StatusBadge tone={WARRANTY_STATUS_TONE[warranty.status] ?? 'neutral'}>
                  {WARRANTY_STATUS_LABEL_ID[warranty.status] ?? warranty.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Laporkan Masalah</h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">
          Ada yang perlu diperbaiki? Laporkan langsung di sini, tanpa perlu menghubungi kami dulu.
        </p>
        <div className="mt-3">
          <ReportServiceTicketForm assets={assets.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </Card>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Tiket Servis Anda</h2>
        {tickets.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada tiket servis yang dilaporkan.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-ink)]">{ticket.title}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Dilaporkan {new Date(ticket.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <StatusBadge tone={SERVICE_TICKET_STATUS_TONE[ticket.status] ?? 'neutral'}>
                  {SERVICE_TICKET_STATUS_LABEL_ID[ticket.status] ?? ticket.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
