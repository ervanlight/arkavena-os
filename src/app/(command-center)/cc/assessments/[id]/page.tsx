import { notFound } from 'next/navigation';
import { getAssessmentReportAction } from '@/modules/assessment';
import { Card, StatusBadge } from '@/core/ui';
import { FindingsForm } from './findings-form';
import { CompleteAssessmentForm } from './complete-form';

export const metadata = { title: 'Detail assessment — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
};

const STATUS_TONE: Record<string, 'warning' | 'success'> = {
  scheduled: 'warning',
  completed: 'success',
};

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await getAssessmentReportAction(id);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const { assessment, site, lead } = result.data;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Assessment — {site.name}</h1>
          <StatusBadge tone={STATUS_TONE[assessment.status] ?? 'neutral'}>
            {STATUS_LABEL_ID[assessment.status] ?? assessment.status}
          </StatusBadge>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Lokasi</dt>
          <dd className="text-[color:var(--color-ink)]">{site.name}</dd>
          {lead !== null && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Lead</dt>
              <dd className="text-[color:var(--color-ink)]">
                <a href={`/cc/leads/${lead.id}`} className="text-[color:var(--color-accent)] underline">
                  {lead.contact_name}
                </a>
              </dd>
            </>
          )}
          {assessment.project_id !== null && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Proyek</dt>
              <dd className="text-[color:var(--color-ink)]">
                <a href={`/cc/projects/${assessment.project_id}`} className="text-[color:var(--color-accent)] underline">
                  Lihat proyek
                </a>
              </dd>
            </>
          )}
          {assessment.status === 'completed' && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Selesai pada</dt>
              <dd className="text-[color:var(--color-ink)]">
                {assessment.assessed_at !== null ? new Date(assessment.assessed_at).toLocaleString('id-ID') : '—'}
              </dd>
            </>
          )}
        </dl>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Temuan</h2>
        <FindingsForm
          assessmentId={assessment.id}
          siteConditions={assessment.site_conditions}
          recommendedScope={assessment.recommended_scope}
          notes={assessment.notes}
          disabled={assessment.status === 'completed'}
        />
      </Card>

      {assessment.status === 'scheduled' && (
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Selesaikan assessment</h2>
          <CompleteAssessmentForm assessmentId={assessment.id} />
        </Card>
      )}
    </div>
  );
}
