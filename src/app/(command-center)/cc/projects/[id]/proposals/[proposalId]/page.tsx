import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalAction } from '@/modules/estimating';
import { Card, StatusBadge, Button } from '@/core/ui';
import { SendProposalForm } from './send-form';
import { DecideProposalForm } from './decide-form';

export const metadata = { title: 'Detail proposal — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  accepted: 'Diterima',
  rejected: 'Ditolak',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'info',
  sent: 'warning',
  accepted: 'success',
  rejected: 'danger',
};

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { id, proposalId } = await params;

  const result = await getProposalAction(proposalId);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const proposal = result.data;

  return (
    <div className="space-y-8">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Proposal</h2>
          <div className="flex items-center gap-2">
            <StatusBadge tone={STATUS_TONE[proposal.status] ?? 'neutral'}>
              {STATUS_LABEL_ID[proposal.status] ?? proposal.status}
            </StatusBadge>
            <Link href={`/cc/projects/${id}/estimates`}>
              <Button type="button" variant="secondary" size="sm">
                Kembali ke estimasi
              </Button>
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Terkirim pada</dt>
          <dd className="text-[color:var(--color-ink)]">
            {proposal.sent_at !== null ? new Date(proposal.sent_at).toLocaleString('id-ID') : '—'}
          </dd>
          {proposal.decided_at !== null && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Diputuskan pada</dt>
              <dd className="text-[color:var(--color-ink)]">{new Date(proposal.decided_at).toLocaleString('id-ID')}</dd>
              <dt className="text-[color:var(--color-ink-tertiary)]">Alasan</dt>
              <dd className="text-[color:var(--color-ink)]">{proposal.decision_reason ?? '—'}</dd>
            </>
          )}
        </dl>
      </Card>

      {proposal.status === 'draft' && (
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Kirim proposal</h2>
          <SendProposalForm proposalId={proposal.id} />
        </Card>
      )}

      {proposal.status === 'sent' && (
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Keputusan klien</h2>
          <DecideProposalForm proposalId={proposal.id} />
        </Card>
      )}
    </div>
  );
}
