import { notFound } from 'next/navigation';
import { getAssessmentReportAction } from '@/modules/assessment';
import { FindingsForm } from './findings-form';
import { CompleteAssessmentForm } from './complete-form';

export const metadata = { title: 'Detail assessment — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
};

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await getAssessmentReportAction(id);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-red-600">
        {result.error.message}
      </p>
    );
  }

  const { assessment, site, lead } = result.data;

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Assessment — {site.name}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {STATUS_LABEL_ID[assessment.status] ?? assessment.status}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Lokasi</dt>
          <dd className="text-slate-900">{site.name}</dd>
          {lead !== null && (
            <>
              <dt className="text-slate-500">Lead</dt>
              <dd className="text-slate-900">
                <a href={`/cc/leads/${lead.id}`} className="text-slate-700 underline">
                  {lead.contact_name}
                </a>
              </dd>
            </>
          )}
          {assessment.project_id !== null && (
            <>
              <dt className="text-slate-500">Proyek</dt>
              <dd className="text-slate-900">
                <a href={`/cc/projects/${assessment.project_id}`} className="text-slate-700 underline">
                  Lihat proyek
                </a>
              </dd>
            </>
          )}
          {assessment.status === 'completed' && (
            <>
              <dt className="text-slate-500">Selesai pada</dt>
              <dd className="text-slate-900">
                {assessment.assessed_at !== null ? new Date(assessment.assessed_at).toLocaleString('id-ID') : '—'}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Temuan</h2>
        <FindingsForm
          assessmentId={assessment.id}
          siteConditions={assessment.site_conditions}
          recommendedScope={assessment.recommended_scope}
          notes={assessment.notes}
          disabled={assessment.status === 'completed'}
        />
      </div>

      {assessment.status === 'scheduled' && (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Selesaikan assessment</h2>
          <CompleteAssessmentForm assessmentId={assessment.id} />
        </div>
      )}
    </div>
  );
}
