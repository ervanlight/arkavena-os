import Link from 'next/link';
import { listAssessmentsAction } from '@/modules/assessment';
import { Card, PageHeader, StatusBadge, EmptyState } from '@/core/ui';

export const metadata = { title: 'Assessment — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
};

const STATUS_TONE: Record<string, 'warning' | 'success'> = {
  scheduled: 'warning',
  completed: 'success',
};

export default async function AssessmentsPage() {
  const result = await listAssessmentsAction(undefined);
  const assessments = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment"
        actions={
          <Link
            href="/cc/assessments/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah assessment
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && assessments.length === 0 && (
        <EmptyState title="Belum ada assessment" description="Tambahkan assessment pertama Anda." />
      )}

      {assessments.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {assessments.map((assessment) => (
              <li key={assessment.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/cc/assessments/${assessment.id}`}
                    className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline"
                  >
                    {STATUS_LABEL_ID[assessment.status] ?? assessment.status}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-tertiary)]">
                    {assessment.recommended_scope ?? '—'} · {new Date(assessment.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <StatusBadge tone={STATUS_TONE[assessment.status] ?? 'neutral'}>
                  {STATUS_LABEL_ID[assessment.status] ?? assessment.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
