import Link from 'next/link';
import { listCostLibraryItemsAction } from '@/modules/estimating';
import { Card, PageHeader, EmptyState } from '@/core/ui';

export const metadata = { title: 'Cost Library — BuildTrust OS' };

export default async function CostLibraryPage() {
  const result = await listCostLibraryItemsAction(undefined);
  const items = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Library"
        actions={
          <Link
            href="/cc/cost-library/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah item
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && items.length === 0 && <EmptyState title="Belum ada item cost library" />}

      {items.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                    {item.unit} · {item.category ?? '—'}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-medium text-[color:var(--color-ink)]">
                  Rp {item.default_unit_cost.toLocaleString('id-ID')}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
