import { notFound } from 'next/navigation';
import { getLeadAction, listClientsAction, listSitesAction, scoreLead } from '@/modules/crm';
import { Card, StatusBadge } from '@/core/ui';
import { LeadStatusForm } from './status-form';
import { ConvertLeadForm } from './convert-form';

export const metadata = { title: 'Detail lead — BuildTrust OS' };

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

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [result, clientsResult, sitesResult] = await Promise.all([
    getLeadAction(id),
    listClientsAction(undefined),
    listSitesAction(undefined),
  ]);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const lead = result.data;
  const desiredStartWithin90Days =
    lead.desired_start_date !== null &&
    new Date(lead.desired_start_date).getTime() - Date.now() <= 90 * 24 * 60 * 60 * 1000;
  const score = scoreLead({
    budgetKnown: lead.budget_known,
    desiredStartWithin90Days,
    referredByExistingClient: lead.client_id !== null,
    // ADR 0018 SS1: estimated project value >= Rp 500.000.000.
    estimatedValueAtLeastThreshold: lead.estimated_value !== null && lead.estimated_value >= 500_000_000n,
  });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">{lead.contact_name}</h1>
          <StatusBadge tone={STATUS_TONE[lead.status] ?? 'neutral'}>
            {STATUS_LABEL_ID[lead.status] ?? lead.status}
          </StatusBadge>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Email</dt>
          <dd className="text-[color:var(--color-ink)]">{lead.email ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Telepon</dt>
          <dd className="text-[color:var(--color-ink)]">{lead.phone ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Sumber</dt>
          <dd className="text-[color:var(--color-ink)]">{lead.source ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Estimasi nilai</dt>
          <dd className="text-[color:var(--color-ink)]">
            {lead.estimated_value !== null ? `Rp ${lead.estimated_value.toLocaleString('id-ID')}` : '—'}
          </dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Skor lead</dt>
          <dd className="text-[color:var(--color-ink)]">{score} / 100</dd>
          {lead.status === 'lost' && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Alasan lost</dt>
              <dd className="text-[color:var(--color-ink)]">{lead.lost_reason ?? '—'}</dd>
            </>
          )}
          {lead.project_id !== null && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Proyek</dt>
              <dd className="text-[color:var(--color-ink)]">
                <a href={`/cc/projects/${lead.project_id}`} className="text-[color:var(--color-accent)] underline">
                  Lihat proyek
                </a>
              </dd>
            </>
          )}
        </dl>
      </Card>

      {lead.project_id === null && (
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Ubah status</h2>
          <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
        </Card>
      )}

      {lead.status === 'qualified' && lead.project_id === null && (
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Konversi ke proyek</h2>
          <ConvertLeadForm
            leadId={lead.id}
            defaultProjectName={lead.contact_name}
            clients={clientsResult.ok ? clientsResult.data : []}
            sites={sitesResult.ok ? sitesResult.data : []}
          />
        </Card>
      )}
    </div>
  );
}
