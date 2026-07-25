import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEstimateWithMarginAction, listProposalsForProjectAction } from '@/modules/estimating';
import { Card, StatusBadge, Button } from '@/core/ui';
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
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
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
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold text-[color:var(--color-ink)]">
            {estimate.title} — V{estimate.version}
          </h2>
          <div className="flex items-center gap-2">
            {estimate.is_baseline && <StatusBadge tone="success">Baseline</StatusBadge>}
            <Link href={`/cc/projects/${id}/estimates`}>
              <Button type="button" variant="secondary" size="sm">
                Kembali
              </Button>
            </Link>
          </div>
        </div>
        {estimate.notes !== null && (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">{estimate.notes}</p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Ringkasan margin</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Total biaya</dt>
          <dd className="text-[color:var(--color-ink)]">Rp {margin.totalCost.toLocaleString('id-ID')}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Total harga</dt>
          <dd className="text-[color:var(--color-ink)]">Rp {margin.totalPrice.toLocaleString('id-ID')}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Margin</dt>
          <dd className="text-[color:var(--color-ink)]">
            Rp {margin.marginAmount.toLocaleString('id-ID')}
            {margin.marginBp !== null ? ` (${(margin.marginBp / 100).toFixed(2)}%)` : ''}
          </dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Batas margin organisasi</dt>
          <dd className="text-[color:var(--color-ink)]">{(marginFloorBp / 100).toFixed(2)}%</dd>
        </dl>
        {belowMarginFloor && (
          <p role="alert" className="rounded-[var(--radius-control)] bg-[color:var(--color-warning)]/14 px-3 py-2 text-sm text-[#a05a00]">
            Margin estimasi ini di bawah batas margin organisasi. Ini hanya peringatan, bukan penghalang
            (ARCHITECTURE.md 0.3).
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Item estimasi</h2>
        {items.length === 0 && <p className="text-sm text-[color:var(--color-ink-tertiary)]">Belum ada item.</p>}
        {items.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{item.description}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    {item.quantity} {item.unit}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-medium text-[color:var(--color-ink)]">
                    Rp {item.unit_price.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    biaya Rp {item.unit_cost.toLocaleString('id-ID')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Card className="border border-dashed border-[color:var(--color-hairline)] shadow-none">
          <AddItemForm estimateId={estimate.id} />
        </Card>
      </Card>

      {!estimate.is_baseline && (
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Jadikan baseline</h2>
          <SetBaselineForm estimateId={estimate.id} />
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Proposal</h2>
        {existingProposal !== null ? (
          <Link
            href={`/cc/projects/${id}/proposals/${existingProposal.id}`}
            className="text-sm text-[color:var(--color-accent)] hover:underline"
          >
            Lihat proposal ({existingProposal.status})
          </Link>
        ) : (
          <CreateProposalForm projectId={id} estimateId={estimate.id} />
        )}
      </Card>
    </div>
  );
}
