import type { Route } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatRp } from '@/core/money/rupiah';
import { getBillingPackAction } from '@/modules/invoice-generator';
import { Card } from '@/core/ui';

export const metadata = { title: 'Billing Pack — Arkavena OS' };

const QC_STATUS_LABEL_ID: Record<string, string> = {
  pending: 'Menunggu',
  passed: 'Lulus',
  failed: 'Tidak lulus',
};

/**
 * ARCHITECTURE.md 7's "billing pack (invoice + evidence + QC + variation
 * summary)" -- assembled at request time, no billing_packs table (ADR 0017
 * SS4), so this can never show stale data relative to the modules it
 * summarizes.
 */
export default async function BillingPackPage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id: projectId, invoiceId } = await params;

  const result = await getBillingPackAction(invoiceId);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const { invoice, evidencePhotos, qcStatus, variation } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/cc/projects/${projectId}/invoices` as Route}
          className="text-sm text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink)]"
        >
          ← Invoice
        </Link>
        <h1 className="mt-1 text-[20px] font-semibold text-[color:var(--color-ink)]">Billing Pack — {invoice.title}</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          {formatRp(invoice.amount)} · jatuh tempo {invoice.due_date}
        </p>
      </div>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">QC (hold point)</h2>
        {qcStatus.length === 0 && (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Tidak ada syarat QC untuk milestone ini.</p>
        )}
        <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
          {qcStatus.map((hp, index) => (
            <li key={`${hp.templateName}-${index}`} className="flex items-center justify-between py-2 text-sm">
              <span className="text-[color:var(--color-ink)]">{hp.templateName}</span>
              <span className="text-[color:var(--color-ink-secondary)]">
                {hp.overridden ? 'Di-override TD' : (QC_STATUS_LABEL_ID[hp.status] ?? hp.status)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {variation !== null && (
        <Card>
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Variation terkait</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[color:var(--color-ink-tertiary)]">Judul</dt>
            <dd className="text-[color:var(--color-ink)]">{variation.title}</dd>
            <dt className="text-[color:var(--color-ink-tertiary)]">Status</dt>
            <dd className="text-[color:var(--color-ink)]">{variation.status}</dd>
            <dt className="text-[color:var(--color-ink-tertiary)]">Dampak biaya</dt>
            <dd className="text-[color:var(--color-ink)]">
              {variation.cost_impact_amount === null ? '—' : formatRp(variation.cost_impact_amount)}
            </dd>
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Bukti progres (foto)</h2>
        {evidencePhotos.length === 0 && (
          <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada foto terkait milestone ini.</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {evidencePhotos.map((photo) => (
            <figure
              key={photo.id}
              className="overflow-hidden rounded-[var(--radius-control)] border border-[color:var(--color-hairline)] p-2 text-xs text-[color:var(--color-ink-secondary)]"
            >
              <p>{photo.caption ?? 'Tanpa keterangan'}</p>
              <p className="mt-1 text-[color:var(--color-ink-tertiary)]">
                {new Date(photo.created_at).toLocaleDateString('id-ID')}
              </p>
            </figure>
          ))}
        </div>
      </Card>
    </div>
  );
}
