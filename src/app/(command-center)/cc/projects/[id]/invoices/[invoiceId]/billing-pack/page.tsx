import type { Route } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatRp } from '@/core/money/rupiah';
import { getBillingPackAction } from '@/modules/billing';

export const metadata = { title: 'Billing Pack — BuildTrust OS' };

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
      <p role="alert" className="text-sm text-red-600">
        {result.error.message}
      </p>
    );
  }

  const { invoice, evidencePhotos, qcStatus, variation } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/cc/projects/${projectId}/invoices` as Route} className="text-sm text-slate-500 hover:text-slate-900">
          ← Invoice
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Billing Pack — {invoice.title}</h1>
        <p className="text-sm text-slate-500">{formatRp(invoice.amount)} · jatuh tempo {invoice.due_date}</p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">QC (hold point)</h2>
        {qcStatus.length === 0 && <p className="mt-2 text-sm text-slate-500">Tidak ada syarat QC untuk milestone ini.</p>}
        <ul className="mt-3 divide-y divide-slate-100">
          {qcStatus.map((hp, index) => (
            <li key={`${hp.templateName}-${index}`} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-900">{hp.templateName}</span>
              <span className="text-slate-600">
                {hp.overridden ? 'Di-override TD' : (QC_STATUS_LABEL_ID[hp.status] ?? hp.status)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {variation !== null && (
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Variation terkait</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Judul</dt>
            <dd className="text-slate-900">{variation.title}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd className="text-slate-900">{variation.status}</dd>
            <dt className="text-slate-500">Dampak biaya</dt>
            <dd className="text-slate-900">
              {variation.cost_impact_amount === null ? '—' : formatRp(variation.cost_impact_amount)}
            </dd>
          </dl>
        </section>
      )}

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Bukti progres (foto)</h2>
        {evidencePhotos.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada foto terkait milestone ini.</p>}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {evidencePhotos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-md border border-slate-200 p-2 text-xs text-slate-600">
              <p>{photo.caption ?? 'Tanpa keterangan'}</p>
              <p className="mt-1 text-slate-400">{new Date(photo.created_at).toLocaleDateString('id-ID')}</p>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
