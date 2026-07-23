import { notFound } from 'next/navigation';
import { getLeadAction, listClientsAction, listSitesAction, scoreLead } from '@/modules/crm';
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
      <p role="alert" className="text-sm text-red-600">
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
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{lead.contact_name}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {STATUS_LABEL_ID[lead.status] ?? lead.status}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Email</dt>
          <dd className="text-slate-900">{lead.email ?? '—'}</dd>
          <dt className="text-slate-500">Telepon</dt>
          <dd className="text-slate-900">{lead.phone ?? '—'}</dd>
          <dt className="text-slate-500">Sumber</dt>
          <dd className="text-slate-900">{lead.source ?? '—'}</dd>
          <dt className="text-slate-500">Estimasi nilai</dt>
          <dd className="text-slate-900">
            {lead.estimated_value !== null ? `Rp ${lead.estimated_value.toLocaleString('id-ID')}` : '—'}
          </dd>
          <dt className="text-slate-500">Skor lead</dt>
          <dd className="text-slate-900">{score} / 100</dd>
          {lead.status === 'lost' && (
            <>
              <dt className="text-slate-500">Alasan lost</dt>
              <dd className="text-slate-900">{lead.lost_reason ?? '—'}</dd>
            </>
          )}
          {lead.project_id !== null && (
            <>
              <dt className="text-slate-500">Proyek</dt>
              <dd className="text-slate-900">
                <a href={`/cc/projects/${lead.project_id}`} className="text-slate-700 underline">
                  Lihat proyek
                </a>
              </dd>
            </>
          )}
        </dl>
      </div>

      {lead.project_id === null && (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Ubah status</h2>
          <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
        </div>
      )}

      {lead.status === 'qualified' && lead.project_id === null && (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Konversi ke proyek</h2>
          <ConvertLeadForm
            leadId={lead.id}
            defaultProjectName={lead.contact_name}
            clients={clientsResult.ok ? clientsResult.data : []}
            sites={sitesResult.ok ? sitesResult.data : []}
          />
        </div>
      )}
    </div>
  );
}
