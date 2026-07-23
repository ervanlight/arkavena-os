import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEstimateWithMarginAction, listProposalsForProjectAction } from '@/modules/estimating';
import { AddItemForm } from './add-item-form';
import { SetBaselineForm } from './set-baseline-form';
import { CreateProposalForm } from './create-proposal-form';

export const metadata = { title: 'Detail estimasi — BuildTrust OS' };

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string; estimateId: string }>;
}) {
  const { id, estimateId } = await params;

  const [result, proposalsResult] = await Promise.all([
    getEstimateWithMarginAction(estimateId),
    listProposalsForProjectAction(id),
  ]);

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-red-600">
        {result.error.message}
      </p>
    );
  }

  const { estimate, items, margin, marginFloorBp, belowMarginFloor } = result.data;
  const existingProposal = proposalsResult.ok
    ? (proposalsResult.data.find((p) => p.estimate_id === estimate.id) ?? null)
    : null;

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">
            {estimate.title} — V{estimate.version}
          </h1>
          <div className="flex items-center gap-2">
            {estimate.is_baseline && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                Baseline
              </span>
            )}
            <Link
              href={`/cc/projects/${id}/estimates`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </Link>
          </div>
        </div>
        {estimate.notes !== null && <p className="mt-2 text-sm text-slate-600">{estimate.notes}</p>}
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Ringkasan margin</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Total biaya</dt>
          <dd className="text-slate-900">Rp {margin.totalCost.toLocaleString('id-ID')}</dd>
          <dt className="text-slate-500">Total harga</dt>
          <dd className="text-slate-900">Rp {margin.totalPrice.toLocaleString('id-ID')}</dd>
          <dt className="text-slate-500">Margin</dt>
          <dd className="text-slate-900">
            Rp {margin.marginAmount.toLocaleString('id-ID')}
            {margin.marginBp !== null ? ` (${(margin.marginBp / 100).toFixed(2)}%)` : ''}
          </dd>
          <dt className="text-slate-500">Batas margin organisasi</dt>
          <dd className="text-slate-900">{(marginFloorBp / 100).toFixed(2)}%</dd>
        </dl>
        {belowMarginFloor && (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Margin estimasi ini di bawah batas margin organisasi. Ini hanya peringatan, bukan penghalang
            (ARCHITECTURE.md 0.3).
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Item estimasi</h2>
        {items.length === 0 && <p className="text-sm text-slate-500">Belum ada item.</p>}
        {items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Deskripsi</th>
                  <th className="px-4 py-2 font-medium">Satuan</th>
                  <th className="px-4 py-2 font-medium">Kuantitas</th>
                  <th className="px-4 py-2 font-medium">Harga satuan</th>
                  <th className="px-4 py-2 font-medium">Biaya satuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{item.description}</td>
                    <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                    <td className="px-4 py-2 text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-2 text-slate-600">Rp {item.unit_price.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-slate-600">Rp {item.unit_cost.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <AddItemForm estimateId={estimate.id} />
        </div>
      </div>

      {!estimate.is_baseline && (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Jadikan baseline</h2>
          <SetBaselineForm estimateId={estimate.id} />
        </div>
      )}

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Proposal</h2>
        {existingProposal !== null ? (
          <Link
            href={`/cc/projects/${id}/proposals/${existingProposal.id}`}
            className="text-sm text-slate-700 underline"
          >
            Lihat proposal ({existingProposal.status})
          </Link>
        ) : (
          <CreateProposalForm projectId={id} estimateId={estimate.id} />
        )}
      </div>
    </div>
  );
}
