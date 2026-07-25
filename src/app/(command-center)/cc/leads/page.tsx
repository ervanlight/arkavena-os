import Link from 'next/link';
import { listLeadsAction } from '@/modules/crm';
import { Card, PageHeader, StatusBadge, EmptyState } from '@/core/ui';

export const metadata = { title: 'Leads — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  new: 'Baru',
  contacted: 'Dihubungi',
  qualified: 'Qualified',
  assessment_scheduled: 'Assessment terjadwal',
  proposal_sent: 'Proposal terkirim',
  won: 'Won',
  lost: 'Lost',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  new: 'neutral',
  contacted: 'info',
  qualified: 'success',
  assessment_scheduled: 'warning',
  proposal_sent: 'info',
  won: 'success',
  lost: 'danger',
};

export default async function LeadsPage() {
  const result = await listLeadsAction(undefined);
  const leads = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        actions={
          <Link
            href="/cc/leads/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah lead
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && leads.length === 0 && <EmptyState title="Belum ada lead" description="Tambahkan lead pertama Anda." />}

      {leads.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {leads.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/cc/leads/${lead.id}`} className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline">
                    {lead.contact_name}
                  </Link>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                    {lead.source ?? '—'} ·{' '}
                    {lead.estimated_value !== null ? `Rp ${lead.estimated_value.toLocaleString('id-ID')}` : '—'}
                  </p>
                </div>
                <StatusBadge tone={STATUS_TONE[lead.status] ?? 'neutral'}>
                  {STATUS_LABEL_ID[lead.status] ?? lead.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
