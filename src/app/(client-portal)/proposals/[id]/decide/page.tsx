import { notFound } from 'next/navigation';
import { getProposalAction } from '@/modules/estimating';
import { ClientProposalDecisionForm } from './client-proposal-decision-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Keputusan Proposal — Arkavena OS' };

/**
 * ADR 0026 §5 amendment (F1): a client's proposal accept/decline moment,
 * mirroring /variations/[id]/approve exactly. Only `client_summary` (staff-
 * authored plain language) is shown, never the estimate/cost breakdown --
 * `estimating` stays Internal Only for its mechanism (ADR 0026 §5).
 */
const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'sedang disiapkan tim kami',
  sent: 'menunggu keputusan Anda',
  accepted: 'Anda terima',
  rejected: 'Anda tolak',
};

export default async function DecideProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await getProposalAction(id);

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const proposal = result.data;
  const alreadyDecided = proposal.status !== 'sent';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Proposal untuk proyek Anda</h1>

      <Card>
        <p className="text-sm text-[color:var(--color-ink)]">
          {proposal.client_summary ?? 'Tim kami telah menyiapkan proposal untuk proyek Anda.'}
        </p>
      </Card>

      {alreadyDecided ? (
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Proposal ini {STATUS_LABEL_ID[proposal.status] ?? 'sudah diputuskan sebelumnya'}.
        </p>
      ) : (
        <Card>
          <ClientProposalDecisionForm proposalId={proposal.id} />
        </Card>
      )}
    </div>
  );
}
