import { notFound } from 'next/navigation';
import { getChangeOrderAction } from '@/modules/scope-variation';
import { ClientDecisionForm } from './client-decision-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Persetujuan Variation — Arkavena OS' };

/**
 * Plain-language status, never the raw enum (Fase 1 fix, IMPLEMENTATION_PRIORITIES.md F2 /
 * ARCHITECTURE_REVIEW.md's variation-approval finding): a client should never see
 * "awaiting_client_approval" interpolated into a sentence.
 *
 * Post-implementation review fix (C2): title/description/cost impact/
 * schedule impact used to render here raw -- ADR 0026 §5 is explicit that
 * scope-variation's client-facing moment must read as a simple business
 * question, "bukan 'Variation Request #24' dengan tabel dampak biaya."
 * `change_orders.client_summary` (staff-authored, set at
 * sendChangeOrderToClientAction time) replaces all four fields below.
 */
const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'sedang disiapkan tim kami',
  under_review: 'sedang ditinjau tim kami',
  awaiting_client_approval: 'menunggu keputusan Anda',
  approved_unpaid: 'Anda setujui, menunggu konfirmasi pendanaan',
  approved_funded: 'disetujui dan didanai',
  rejected: 'Anda tolak',
  completed: 'selesai dikerjakan',
};

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
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Variation untuk proyek Anda</h1>

      <Card>
        <p className="text-sm text-[color:var(--color-ink)]">
          {changeOrder.client_summary ?? 'Ada keputusan yang menunggu konfirmasi Anda'}
        </p>
      </Card>

      {alreadyDecided ? (
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Variation ini {STATUS_LABEL_ID[changeOrder.status] ?? 'sudah diputuskan sebelumnya'}.
        </p>
      ) : (
        <Card>
          <ClientDecisionForm changeOrderId={changeOrder.id} />
        </Card>
      )}
    </div>
  );
}
