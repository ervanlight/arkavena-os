import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatRp } from '@/core/money/rupiah';
import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import { getChangeOrderAction } from '@/modules/scope-variation';
import { getProjectAction } from '@/modules/projects';
import { SetImpactForm } from './set-impact-form';
import { SubmitForReviewForm } from './submit-for-review-form';
import { ReviewForm } from './review-form';
import { MarkFundedForm } from './mark-funded-form';
import { CompleteForm } from './complete-form';
import { OpenWorkPackageForm } from './open-work-package-form';

export const metadata = { title: 'Detail Variation — BuildTrust OS' };

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
      <p role="alert" className="text-sm text-red-600">
        {projectResult.error.message}
      </p>
    );
  }
  if (!changeOrderResult.ok) {
    if (changeOrderResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-red-600">
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
    <div className="space-y-8">
      <div>
        <Link href={`/cc/projects/${project.id}/variations`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Variation
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{changeOrder.title}</h1>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium text-slate-900">{STATUS_LABEL_ID[changeOrder.status] ?? changeOrder.status}</dd>
          <dt className="text-slate-500">Keterangan</dt>
          <dd className="text-slate-900">{changeOrder.description ?? '—'}</dd>
          <dt className="text-slate-500">Dampak biaya</dt>
          <dd className="text-slate-900">
            {changeOrder.cost_impact_amount === null ? 'Belum diisi' : formatRp(changeOrder.cost_impact_amount)}
          </dd>
          <dt className="text-slate-500">Dampak jadwal</dt>
          <dd className="text-slate-900">
            {changeOrder.schedule_impact_days === null ? 'Belum diisi' : `${changeOrder.schedule_impact_days} hari`}
          </dd>
          {changeOrder.client_approved_reason !== null && (
            <>
              <dt className="text-slate-500">Catatan klien</dt>
              <dd className="text-slate-900">{changeOrder.client_approved_reason}</dd>
            </>
          )}
          {changeOrder.rejected_reason !== null && (
            <>
              <dt className="text-slate-500">Alasan ditolak</dt>
              <dd className="text-slate-900">{changeOrder.rejected_reason}</dd>
            </>
          )}
        </dl>
      </div>

      {canSetImpact && (changeOrder.status === 'draft' || changeOrder.status === 'under_review') && (
        <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Isi estimasi biaya &amp; jadwal</h2>
          <SetImpactForm
            changeOrderId={changeOrder.id}
            currentCostImpact={changeOrder.cost_impact_amount?.toString() ?? ''}
            currentScheduleImpact={changeOrder.schedule_impact_days ?? ''}
          />
        </section>
      )}

      {canSubmitForReview && changeOrder.status === 'draft' && (
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <SubmitForReviewForm changeOrderId={changeOrder.id} />
        </section>
      )}

      {canReview && changeOrder.status === 'under_review' && (
        <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Review internal</h2>
          <ReviewForm changeOrderId={changeOrder.id} />
        </section>
      )}

      {changeOrder.status === 'awaiting_client_approval' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-sm text-blue-900">
          Menunggu keputusan klien. Klien menerima link persetujuan terpisah.
        </div>
      )}

      {canMarkFunded && changeOrder.status === 'approved_unpaid' && (
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <MarkFundedForm changeOrderId={changeOrder.id} />
        </section>
      )}

      {canComplete && changeOrder.status === 'approved_funded' && (
        <section className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Buka paket kerja</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dana sudah masuk -- tim lapangan sekarang boleh mengerjakan variation ini.
            </p>
            <div className="mt-3">
              <OpenWorkPackageForm projectId={project.id} changeOrderId={changeOrder.id} />
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <CompleteForm changeOrderId={changeOrder.id} />
          </div>
        </section>
      )}
    </div>
  );
}
