import Link from 'next/link';
import { listEstimatesForProjectAction } from '@/modules/estimating';
import { Button, Card, EmptyState, StatusBadge } from '@/core/ui';

export const metadata = { title: 'Estimasi — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  accepted: 'Diterima',
  rejected: 'Ditolak',
  superseded: 'Digantikan',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'info',
  sent: 'warning',
  accepted: 'success',
  rejected: 'danger',
  superseded: 'neutral',
};

export default async function ProjectEstimatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await listEstimatesForProjectAction(id);
  const estimates = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Estimasi</h2>
        <Link href={`/cc/projects/${id}/estimates/new`}>
          <Button type="button">Buat estimasi</Button>
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && estimates.length === 0 && <EmptyState title="Belum ada estimasi untuk proyek ini" />}

      {estimates.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {estimates.map((estimate) => (
              <li key={estimate.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/cc/projects/${id}/estimates/${estimate.id}`}
                    className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline"
                  >
                    V{estimate.version} — {estimate.title}
                  </Link>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {estimate.is_baseline && <StatusBadge tone="success">Baseline</StatusBadge>}
                  <StatusBadge tone={STATUS_TONE[estimate.status] ?? 'neutral'}>
                    {STATUS_LABEL_ID[estimate.status] ?? estimate.status}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
