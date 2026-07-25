import Link from 'next/link';
import { listAssetsAction } from '@/modules/maintenance-engine';
import { Card, PageHeader, EmptyState } from '@/core/ui';

export const metadata = { title: 'Aset — BuildTrust OS' };

export default async function AssetsPage() {
  const result = await listAssetsAction(undefined);
  const assets = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aset (Facility Passport)"
        actions={
          <Link
            href="/cc/assets/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah aset
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && assets.length === 0 && <EmptyState title="Belum ada aset" />}

      {assets.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {assets.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/cc/assets/${asset.id}`}
                    className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline"
                  >
                    {asset.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                    {[asset.manufacturer, asset.model].filter(Boolean).join(' / ') || '—'}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-[color:var(--color-ink-secondary)]">{asset.category ?? '—'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
