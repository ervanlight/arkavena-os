import { notFound } from 'next/navigation';
import {
  computeNextDueDate,
  getAssetAction,
  listMaintenancePlansForAssetAction,
  listServiceTicketsForAssetAction,
} from '@/modules/maintenance-engine';
import { Card, StatusBadge, EmptyState } from '@/core/ui';
import { CreateMaintenancePlanForm } from './maintenance-plan-form';
import { MarkPlanCompletedForm } from './mark-plan-completed-form';
import { CreateServiceTicketForm } from './service-ticket-form';
import { ServiceTicketStatusForm } from './service-ticket-status-form';

export const metadata = { title: 'Detail aset — Arkavena OS' };

const SERVICE_TICKET_STATUS_LABEL_ID: Record<string, string> = {
  open: 'Terbuka',
  in_progress: 'Dikerjakan',
  resolved: 'Selesai',
  cancelled: 'Dibatalkan',
};

const SERVICE_TICKET_STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  cancelled: 'neutral',
};

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [assetResult, plansResult, ticketsResult] = await Promise.all([
    getAssetAction(id),
    listMaintenancePlansForAssetAction(id),
    listServiceTicketsForAssetAction(id),
  ]);

  if (!assetResult.ok) {
    if (assetResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {assetResult.error.message}
      </p>
    );
  }

  const asset = assetResult.data;
  const plans = plansResult.ok ? plansResult.data : [];
  const tickets = ticketsResult.ok ? ticketsResult.data : [];
  const now = Date.now();

  return (
    <div className="space-y-8">
      <Card>
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">{asset.name}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Kategori</dt>
          <dd className="text-[color:var(--color-ink)]">{asset.category ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Merek/Model</dt>
          <dd className="text-[color:var(--color-ink)]">{[asset.manufacturer, asset.model].filter(Boolean).join(' / ') || '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Nomor seri</dt>
          <dd className="text-[color:var(--color-ink)]">{asset.serial_number ?? '—'}</dd>
        </dl>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Jadwal perawatan</h2>
        {plans.length === 0 && <EmptyState title="Belum ada jadwal perawatan" />}
        {plans.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {plans.map((plan) => {
              const schedule = computeNextDueDate({
                intervalDays: plan.interval_days,
                startsAtMs: Date.parse(plan.starts_at),
                lastCompletedAtMs: plan.last_completed_at !== null ? Date.parse(plan.last_completed_at) : null,
                nowMs: now,
              });
              const nextDueDate = new Date(schedule.nextDueDateMs).toISOString().slice(0, 10);

              return (
                <li key={plan.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{plan.title}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                      {plan.interval_days} hari · Jatuh tempo berikutnya {nextDueDate}
                      {schedule.overdue && (
                        <>
                          {' '}
                          <StatusBadge tone="danger">Jatuh tempo</StatusBadge>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <MarkPlanCompletedForm planId={plan.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Card className="border border-dashed border-[color:var(--color-hairline)] shadow-none">
          <CreateMaintenancePlanForm assetId={asset.id} />
        </Card>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Tiket servis</h2>
        {tickets.length === 0 && <EmptyState title="Belum ada tiket servis" />}
        {tickets.length > 0 && (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[color:var(--color-ink)]">{ticket.title}</p>
                  <StatusBadge tone={SERVICE_TICKET_STATUS_TONE[ticket.status] ?? 'neutral'}>
                    {SERVICE_TICKET_STATUS_LABEL_ID[ticket.status] ?? ticket.status}
                  </StatusBadge>
                </div>
                {ticket.description !== null && (
                  <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">{ticket.description}</p>
                )}
                {ticket.status !== 'resolved' && ticket.status !== 'cancelled' && (
                  <div className="mt-3">
                    <ServiceTicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        <Card className="border border-dashed border-[color:var(--color-hairline)] shadow-none">
          <CreateServiceTicketForm assetId={asset.id} />
        </Card>
      </Card>
    </div>
  );
}
