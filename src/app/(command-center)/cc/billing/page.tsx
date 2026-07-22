import type { Route } from 'next';
import Link from 'next/link';
import { formatRp } from '@/core/money/rupiah';
import { listAgingDashboardAction, type InvoiceAgingTier } from '@/modules/billing';

export const metadata = { title: 'Aging Dashboard — BuildTrust OS' };

const TIER_LABEL_ID: Record<InvoiceAgingTier, string> = {
  current: 'Belum jatuh tempo',
  overdue_1_30: 'Terlambat 1-30 hari',
  overdue_31_60: 'Terlambat 31-60 hari',
  overdue_61_90: 'Terlambat 61-90 hari',
  overdue_90_plus: 'Terlambat > 90 hari',
};

const TIER_BADGE_CLASS: Record<InvoiceAgingTier, string> = {
  current: 'bg-emerald-100 text-emerald-800',
  overdue_1_30: 'bg-amber-100 text-amber-800',
  overdue_31_60: 'bg-orange-100 text-orange-800',
  overdue_61_90: 'bg-red-100 text-red-800',
  overdue_90_plus: 'bg-red-900 text-white',
};

const TIER_ORDER: InvoiceAgingTier[] = ['overdue_90_plus', 'overdue_61_90', 'overdue_31_60', 'overdue_1_30', 'current'];

export default async function BillingAgingDashboardPage() {
  const result = await listAgingDashboardAction(undefined);
  const rows = result.ok ? result.data : [];

  const byTier = new Map<InvoiceAgingTier, typeof rows>();
  for (const row of rows) {
    const list = byTier.get(row.agingTier) ?? [];
    list.push(row);
    byTier.set(row.agingTier, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Aging Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Setiap invoice yang sudah terbit tapi belum lunas, dikelompokkan berdasarkan seberapa terlambat.
        </p>
      </div>

      {rows.length === 0 && <p className="text-sm text-slate-500">Tidak ada invoice terbit yang belum lunas.</p>}

      <div className="space-y-6">
        {TIER_ORDER.filter((tier) => (byTier.get(tier) ?? []).length > 0).map((tier) => (
          <div key={tier} className="rounded-lg bg-white p-6 shadow-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_BADGE_CLASS[tier]}`}>
              {TIER_LABEL_ID[tier]}
            </span>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Invoice</th>
                    <th className="px-4 py-2 font-medium">Nominal</th>
                    <th className="px-4 py-2 font-medium">Jatuh tempo</th>
                    <th className="px-4 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(byTier.get(tier) ?? []).map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{invoice.title}</td>
                      <td className="px-4 py-2 text-slate-600">{formatRp(invoice.amount)}</td>
                      <td className="px-4 py-2 text-slate-600">{invoice.due_date}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/cc/projects/${invoice.project_id}/invoices` as Route}
                          className="text-xs font-medium text-slate-600 underline"
                        >
                          Lihat
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
