import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalAction } from '@/modules/estimating';
import { SendProposalForm } from './send-form';
import { DecideProposalForm } from './decide-form';

export const metadata = { title: 'Detail proposal — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  accepted: 'Diterima',
  rejected: 'Ditolak',
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
      <p role="alert" className="text-sm text-red-600">
        {result.error.message}
      </p>
    );
  }

  const proposal = result.data;

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Proposal</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {STATUS_LABEL_ID[proposal.status] ?? proposal.status}
            </span>
            <Link
              href={`/cc/projects/${id}/estimates`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Kembali ke estimasi
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Terkirim pada</dt>
          <dd className="text-slate-900">
            {proposal.sent_at !== null ? new Date(proposal.sent_at).toLocaleString('id-ID') : '—'}
          </dd>
          {proposal.decided_at !== null && (
            <>
              <dt className="text-slate-500">Diputuskan pada</dt>
              <dd className="text-slate-900">{new Date(proposal.decided_at).toLocaleString('id-ID')}</dd>
              <dt className="text-slate-500">Alasan</dt>
              <dd className="text-slate-900">{proposal.decision_reason ?? '—'}</dd>
            </>
          )}
        </dl>
      </div>

      {proposal.status === 'draft' && (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Kirim proposal</h2>
          <SendProposalForm proposalId={proposal.id} />
        </div>
      )}

      {proposal.status === 'sent' && (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Keputusan klien</h2>
          <DecideProposalForm proposalId={proposal.id} />
        </div>
      )}
    </div>
  );
}
