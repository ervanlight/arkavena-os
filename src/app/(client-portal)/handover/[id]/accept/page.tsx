import { notFound } from 'next/navigation';
import { getClientDecisionAction } from '@/modules/client-portal';
import { ClientHandoverDecisionForm } from './client-handover-decision-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Konfirmasi Serah Terima — Arkavena OS' };

/**
 * Phase 3 (F6): a client's handover sign-off moment, mirroring
 * /proposals/[id]/decide exactly. Keyed by the client_decisions row's own
 * id (the route's [id]) -- a handover sign-off has no separate source row
 * the way a change_order/proposal does, so there is no other id to key by.
 */
export default async function AcceptHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientDecisionId } = await params;

  const result = await getClientDecisionAction(clientDecisionId);

  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const decision = result.data;
  if (decision === null || !decision.handover_signoff) notFound();

  const alreadyDecided = decision.decided_at !== null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Konfirmasi Serah Terima</h1>

      <Card>
        <p className="text-sm text-[color:var(--color-ink)]">
          {decision.client_summary ?? 'Proyek Anda telah selesai -- mohon konfirmasi serah terima.'}
        </p>
      </Card>

      {alreadyDecided ? (
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Serah terima ini {decision.decision === 'rejected' ? 'Anda tolak' : 'Anda konfirmasi'}.
        </p>
      ) : (
        <Card>
          <ClientHandoverDecisionForm clientDecisionId={decision.id} />
        </Card>
      )}
    </div>
  );
}
