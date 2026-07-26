import type { Route } from 'next';
import Link from 'next/link';
import { formatRp } from '@/core/money/rupiah';
import { listAgingDashboardAction, type InvoiceAgingTier } from '@/modules/invoice-generator';
import { Card, PageHeader, StatusBadge, EmptyState } from '@/core/ui';

export const metadata = { title: 'Aging Dashboard — Arkavena OS' };

const TIER_LABEL_ID: Record<InvoiceAgingTier, string> = {
  current: 'Belum jatuh tempo',
  overdue_1_30: 'Terlambat 1-30 hari',
  overdue_31_60: 'Terlambat 31-60 hari',
  overdue_61_90: 'Terlambat 61-90 hari',
  overdue_90_plus: 'Terlambat > 90 hari',
};

const TIER_TONE: Record<InvoiceAgingTier, 'success' | 'warning' | 'danger'> = {
  current: 'success',
  overdue_1_30: 'warning',
  overdue_31_60: 'warning',
  overdue_61_90: 'danger',
  overdue_90_plus: 'danger',
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
      <PageHeader
        title="Aging Dashboard"
        subtitle="Setiap invoice yang sudah terbit tapi belum lunas, dikelompokkan berdasarkan seberapa terlambat."
      />

      {rows.length === 0 && <EmptyState title="Tidak ada invoice terbit yang belum lunas" />}

      <div className="space-y-6">
        {TIER_ORDER.filter((tier) => (byTier.get(tier) ?? []).length > 0).map((tier) => (
          <Card key={tier}>
            <StatusBadge tone={TIER_TONE[tier]}>{TIER_LABEL_ID[tier]}</StatusBadge>
            <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
              {(byTier.get(tier) ?? []).map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{invoice.title}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                      Jatuh tempo {invoice.due_date}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm text-[color:var(--color-ink-secondary)]">{formatRp(invoice.amount)}</span>
                    <Link
                      href={`/cc/projects/${invoice.project_id}/invoices` as Route}
                      className="text-xs font-medium text-[color:var(--color-accent)] hover:underline"
                    >
                      Lihat
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
