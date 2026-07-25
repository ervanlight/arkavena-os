import { notFound } from 'next/navigation';
import { formatRp } from '@/core/money/rupiah';
import { getChangeOrderAction } from '@/modules/scope-variation';
import { ClientDecisionForm } from './client-decision-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Persetujuan Variation — Arkavena OS' };

/**
 * The "link aman" ARCHITECTURE.md 7 asks for -- reachable both as a
 * standalone link (e.g. from a notification) and now from inside the
 * navigable portal's own Keputusan page (ADR 0016, "approval variation
 * pindah ke portal"), since it shares the (client-portal) layout. Reuses
 * the same signed-in session every other role signs in with (email +
 * password, ADR 0025); proxy.ts already redirects an unauthenticated visitor to
 * /login before this page ever renders. RLS
 * (change_orders_select_client_approver) is what actually decides whether
 * this specific signed-in person can see this specific change order --
 * there is no separate token-based auth here.
 */
export default async function ApproveVariationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await getChangeOrderAction(id);

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const changeOrder = result.data;
  const alreadyDecided = changeOrder.status !== 'awaiting_client_approval';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">{changeOrder.title}</h1>

      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Keterangan</dt>
          <dd className="text-[color:var(--color-ink)]">{changeOrder.description ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Dampak biaya</dt>
          <dd className="font-medium text-[color:var(--color-ink)]">
            {changeOrder.cost_impact_amount === null ? '—' : formatRp(changeOrder.cost_impact_amount)}
          </dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Dampak jadwal</dt>
          <dd className="text-[color:var(--color-ink)]">
            {changeOrder.schedule_impact_days === null ? '—' : `${changeOrder.schedule_impact_days} hari`}
          </dd>
        </dl>
      </Card>

      {alreadyDecided ? (
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Variation ini sudah diputuskan sebelumnya (status saat ini: {changeOrder.status}).
        </p>
      ) : (
        <Card>
          <ClientDecisionForm changeOrderId={changeOrder.id} />
        </Card>
      )}
    </div>
  );
}
