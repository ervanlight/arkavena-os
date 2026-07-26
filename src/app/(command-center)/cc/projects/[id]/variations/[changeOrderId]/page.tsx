import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatRp } from '@/core/money/rupiah';
import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import { getChangeOrderAction } from '@/modules/variations';
import { getProjectAction } from '@/modules/projects';
import { Card } from '@/core/ui';
import { SetImpactForm } from './set-impact-form';
import { SubmitForReviewForm } from './submit-for-review-form';
import { ReviewForm } from './review-form';
import { MarkFundedForm } from './mark-funded-form';
import { CompleteForm } from './complete-form';
import { OpenWorkPackageForm } from './open-work-package-form';

export const metadata = { title: 'Detail Variation — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  under_review: 'Direview internal',
  awaiting_client_approval: 'Menunggu keputusan klien',
  approved_unpaid: 'Disetujui, menunggu dana',
  approved_funded: 'Dana masuk, siap dikerjakan',
  rejected: 'Ditolak',
  completed: 'Selesai',
};

export default async function VariationDetailPage({
  params,
}: {
  params: Promise<{ id: string; changeOrderId: string }>;
}) {
  const { id: projectId, changeOrderId } = await params;

  const [projectResult, changeOrderResult, user] = await Promise.all([
    getProjectAction(projectId),
    getChangeOrderAction(changeOrderId),
    getCurrentUser(),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {projectResult.error.message}
      </p>
    );
  }
  if (!changeOrderResult.ok) {
    if (changeOrderResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {changeOrderResult.error.message}
      </p>
    );
  }

  const project = projectResult.data;
  const changeOrder = changeOrderResult.data;
  const role = user?.orgRole ?? null;

  const canSetImpact = roleCan(role, 'change_order', 'update');
  const canSubmitForReview = roleCan(role, 'change_order', 'submit_review');
  const canReview = roleCan(role, 'change_order', 'review');
  const canMarkFunded = roleCan(role, 'change_order', 'mark_funded');
  const canComplete = roleCan(role, 'change_order', 'complete');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/cc/projects/${project.id}/variations`}
          className="text-sm text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink)]"
        >
          ← Variation
        </Link>
        <h1 className="mt-1 text-[19px] font-semibold text-[color:var(--color-ink)]">{changeOrder.title}</h1>
      </div>

      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Status</dt>
          <dd className="font-medium text-[color:var(--color-ink)]">
            {STATUS_LABEL_ID[changeOrder.status] ?? changeOrder.status}
          </dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Keterangan</dt>
          <dd className="text-[color:var(--color-ink)]">{changeOrder.description ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Dampak biaya</dt>
          <dd className="text-[color:var(--color-ink)]">
            {changeOrder.cost_impact_amount === null ? 'Belum diisi' : formatRp(changeOrder.cost_impact_amount)}
          </dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Dampak jadwal</dt>
          <dd className="text-[color:var(--color-ink)]">
            {changeOrder.schedule_impact_days === null ? 'Belum diisi' : `${changeOrder.schedule_impact_days} hari`}
          </dd>
          {changeOrder.client_approved_reason !== null && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Catatan klien</dt>
              <dd className="text-[color:var(--color-ink)]">{changeOrder.client_approved_reason}</dd>
            </>
          )}
          {changeOrder.rejected_reason !== null && (
            <>
              <dt className="text-[color:var(--color-ink-tertiary)]">Alasan ditolak</dt>
              <dd className="text-[color:var(--color-ink)]">{changeOrder.rejected_reason}</dd>
            </>
          )}
        </dl>
      </Card>

      {canSetImpact && (changeOrder.status === 'draft' || changeOrder.status === 'under_review') && (
        <Card>
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Isi estimasi biaya &amp; jadwal</h2>
          <div className="mt-3">
            <SetImpactForm
              changeOrderId={changeOrder.id}
              currentCostImpact={changeOrder.cost_impact_amount?.toString() ?? ''}
              currentScheduleImpact={changeOrder.schedule_impact_days ?? ''}
            />
          </div>
        </Card>
      )}

      {canSubmitForReview && changeOrder.status === 'draft' && (
        <Card>
          <SubmitForReviewForm changeOrderId={changeOrder.id} />
        </Card>
      )}

      {canReview && changeOrder.status === 'under_review' && (
        <Card>
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Review internal</h2>
          <div className="mt-3">
            <ReviewForm changeOrderId={changeOrder.id} />
          </div>
        </Card>
      )}

      {changeOrder.status === 'awaiting_client_approval' && (
        <div className="rounded-[var(--radius-card)] bg-[color:var(--color-accent)]/10 p-3.5 text-sm text-[color:var(--color-accent-hover)]">
          Menunggu keputusan klien. Klien menerima link persetujuan terpisah.
        </div>
      )}

      {canMarkFunded && changeOrder.status === 'approved_unpaid' && (
        <Card>
          <MarkFundedForm changeOrderId={changeOrder.id} />
        </Card>
      )}

      {canComplete && changeOrder.status === 'approved_funded' && (
        <Card className="space-y-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Buka paket kerja</h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-tertiary)]">
              Dana sudah masuk -- tim lapangan sekarang boleh mengerjakan variation ini.
            </p>
            <div className="mt-3">
              <OpenWorkPackageForm projectId={project.id} changeOrderId={changeOrder.id} />
            </div>
          </div>
          <div className="border-t border-[color:var(--color-hairline)] pt-4">
            <CompleteForm changeOrderId={changeOrder.id} />
          </div>
        </Card>
      )}
    </div>
  );
}
