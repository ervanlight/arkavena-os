import { notFound } from 'next/navigation';
import {
  computeNextDueDate,
  getAssetAction,
  listMaintenancePlansForAssetAction,
  listServiceTicketsForAssetAction,
} from '@/modules/maintenance-engine';
import { CreateMaintenancePlanForm } from './maintenance-plan-form';
import { MarkPlanCompletedForm } from './mark-plan-completed-form';
import { CreateServiceTicketForm } from './service-ticket-form';
import { ServiceTicketStatusForm } from './service-ticket-status-form';

export const metadata = { title: 'Detail aset — BuildTrust OS' };

const SERVICE_TICKET_STATUS_LABEL_ID: Record<string, string> = {
  open: 'Terbuka',
  in_progress: 'Dikerjakan',
  resolved: 'Selesai',
  cancelled: 'Dibatalkan',
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
      <p role="alert" className="text-sm text-red-600">
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
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{asset.name}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Kategori</dt>
          <dd className="text-slate-900">{asset.category ?? '—'}</dd>
          <dt className="text-slate-500">Merek/Model</dt>
          <dd className="text-slate-900">{[asset.manufacturer, asset.model].filter(Boolean).join(' / ') || '—'}</dd>
          <dt className="text-slate-500">Nomor seri</dt>
          <dd className="text-slate-900">{asset.serial_number ?? '—'}</dd>
        </dl>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Jadwal perawatan</h2>
        {plans.length === 0 && <p className="text-sm text-slate-500">Belum ada jadwal perawatan.</p>}
        {plans.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Judul</th>
                  <th className="px-4 py-2 font-medium">Interval</th>
                  <th className="px-4 py-2 font-medium">Jatuh tempo berikutnya</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => {
                  const schedule = computeNextDueDate({
                    intervalDays: plan.interval_days,
                    startsAtMs: Date.parse(plan.starts_at),
                    lastCompletedAtMs: plan.last_completed_at !== null ? Date.parse(plan.last_completed_at) : null,
                    nowMs: now,
                  });
                  const nextDueDate = new Date(schedule.nextDueDateMs).toISOString().slice(0, 10);

                  return (
                    <tr key={plan.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{plan.title}</td>
                      <td className="px-4 py-2 text-slate-600">{plan.interval_days} hari</td>
                      <td className="px-4 py-2 text-slate-600">
                        {nextDueDate}{' '}
                        {schedule.overdue && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            Jatuh tempo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <MarkPlanCompletedForm planId={plan.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <CreateMaintenancePlanForm assetId={asset.id} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Tiket servis</h2>
        {tickets.length === 0 && <p className="text-sm text-slate-500">Belum ada tiket servis.</p>}
        {tickets.length > 0 && (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{ticket.title}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {SERVICE_TICKET_STATUS_LABEL_ID[ticket.status] ?? ticket.status}
                  </span>
                </div>
                {ticket.description !== null && <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>}
                {ticket.status !== 'resolved' && ticket.status !== 'cancelled' && (
                  <div className="mt-3">
                    <ServiceTicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <CreateServiceTicketForm assetId={asset.id} />
        </div>
      </div>
    </div>
  );
}
