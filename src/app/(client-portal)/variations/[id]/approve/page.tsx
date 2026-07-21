import { notFound } from 'next/navigation';
import { formatRp } from '@/core/money/rupiah';
import { getChangeOrderAction } from '@/modules/scope-variation';
import { ClientDecisionForm } from './client-decision-form';

export const metadata = { title: 'Persetujuan Variation — BuildTrust OS' };

/**
 * The "link aman" ARCHITECTURE.md 7 asks for -- one purpose-built page, not
 * a navigable portal (Fase 6 is what builds that). Reuses the same
 * magic-link session every other role signs in with (owner decision D4);
 * proxy.ts already redirects an unauthenticated visitor to /login before
 * this page ever renders. RLS (change_orders_select_client_approver) is
 * what actually decides whether this specific signed-in person can see this
 * specific change order -- there is no separate token-based auth here.
 */
export default async function ApproveVariationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await getChangeOrderAction(id);

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      </main>
    );
  }

  const changeOrder = result.data;
  const alreadyDecided = changeOrder.status !== 'awaiting_client_approval';

  return (
    <main className="mx-auto max-w-lg space-y-6 px-6 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">BuildTrust OS</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{changeOrder.title}</h1>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Keterangan</dt>
          <dd className="text-slate-900">{changeOrder.description ?? '—'}</dd>
          <dt className="text-slate-500">Dampak biaya</dt>
          <dd className="font-medium text-slate-900">
            {changeOrder.cost_impact_amount === null ? '—' : formatRp(changeOrder.cost_impact_amount)}
          </dd>
          <dt className="text-slate-500">Dampak jadwal</dt>
          <dd className="text-slate-900">
            {changeOrder.schedule_impact_days === null ? '—' : `${changeOrder.schedule_impact_days} hari`}
          </dd>
        </dl>
      </div>

      {alreadyDecided ? (
        <p className="text-sm text-slate-500">
          Variation ini sudah diputuskan sebelumnya (status saat ini: {changeOrder.status}).
        </p>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <ClientDecisionForm changeOrderId={changeOrder.id} />
        </div>
      )}
    </main>
  );
}
