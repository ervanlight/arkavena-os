import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatRp } from '@/core/money/rupiah';
import { getProjectAction } from '@/modules/projects';
import { listChangeOrdersForProjectAction } from '@/modules/scope-variation';
import { Card, StatusBadge, EmptyState } from '@/core/ui';
import { CreateVariationForm } from './create-variation-form';

export const metadata = { title: 'Variation — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  under_review: 'Direview internal',
  awaiting_client_approval: 'Menunggu keputusan klien',
  approved_unpaid: 'Disetujui, menunggu dana',
  approved_funded: 'Dana masuk, siap dikerjakan',
  rejected: 'Ditolak',
  completed: 'Selesai',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'neutral',
  under_review: 'warning',
  awaiting_client_approval: 'info',
  approved_unpaid: 'warning',
  approved_funded: 'success',
  rejected: 'danger',
  completed: 'success',
};

export default async function VariationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const [projectResult, changeOrdersResult] = await Promise.all([
    getProjectAction(projectId),
    listChangeOrdersForProjectAction(projectId),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {projectResult.error.message}
      </p>
    );
  }

  const project = projectResult.data;
  const changeOrders = changeOrdersResult.ok ? changeOrdersResult.data : [];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Ajukan variation baru</h2>
        <div className="mt-3">
          <CreateVariationForm projectId={project.id} />
        </div>
      </Card>

      <Card>
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Daftar variation</h2>
        {!changeOrdersResult.ok && (
          <p role="alert" className="mt-3 text-sm text-[color:var(--color-danger)]">
            {changeOrdersResult.error.message}
          </p>
        )}
        {changeOrders.length === 0 && (
          <div className="mt-3">
            <EmptyState title="Belum ada variation" />
          </div>
        )}
        {changeOrders.length > 0 && (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {changeOrders.map((co) => (
              <li key={co.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/cc/projects/${project.id}/variations/${co.id}`}
                    className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline"
                  >
                    {co.title}
                  </Link>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    {co.cost_impact_amount === null ? '—' : formatRp(co.cost_impact_amount)}
                  </p>
                </div>
                <StatusBadge tone={STATUS_TONE[co.status] ?? 'neutral'}>
                  {STATUS_LABEL_ID[co.status] ?? co.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
