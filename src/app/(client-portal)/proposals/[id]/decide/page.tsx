import { notFound } from 'next/navigation';
import { getClientDecisionForProposalAction } from '@/modules/client-portal';
import { ClientProposalDecisionForm } from './client-proposal-decision-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Keputusan Proposal — Arkavena OS' };

/**
 * ADR 0026 §5 amendment (F1): a client's proposal accept/decline moment,
 * mirroring /variations/[id]/approve exactly. Only `client_summary` (staff-
 * authored plain language) is shown, never the estimate/cost breakdown --
 * `estimating` stays Internal Only for its mechanism (ADR 0026 §5).
 *
 * Post-implementation review fix (C1, ADR 0026 §7 item 7): reads
 * `client_decisions` (client-portal's own table, synced from `proposals` by
 * fn_proposals_sync_client_decision) instead of importing
 * `@/modules/estimating` directly -- ARCHITECTURE.md 1.2 (F25) forbids that
 * import regardless of how narrow the field list looked.
 */
export default async function DecideProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params;

  const result = await getClientDecisionForProposalAction(proposalId);

  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const decision = result.data;
  if (decision === null) notFound();

  const alreadyDecided = decision.decided_at !== null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Proposal untuk proyek Anda</h1>

      <Card>
        <p className="text-sm text-[color:var(--color-ink)]">
          {decision.client_summary ?? 'Tim kami telah menyiapkan proposal untuk proyek Anda.'}
        </p>
      </Card>

      {alreadyDecided ? (
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Proposal ini {decision.decision === 'rejected' ? 'Anda tolak' : 'Anda terima'}.
        </p>
      ) : (
        <Card>
          <ClientProposalDecisionForm proposalId={proposalId} />
        </Card>
      )}
    </div>
  );
}
