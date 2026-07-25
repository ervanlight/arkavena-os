import type { Route } from 'next';
import Link from 'next/link';
import { listVendorsAction } from '@/modules/procurement';
import { Card, PageHeader, EmptyState } from '@/core/ui';

export const metadata = { title: 'Vendor — Arkavena OS' };

export default async function VendorsPage() {
  const result = await listVendorsAction(undefined);
  const vendors = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor"
        actions={
          <Link
            href="/cc/vendors/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah vendor
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && vendors.length === 0 && <EmptyState title="Belum ada vendor" />}

      {vendors.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {vendors.map((vendor) => (
              <li key={vendor.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/cc/vendors/${vendor.id}` as Route}
                    className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline"
                  >
                    {vendor.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">{vendor.contact_name ?? '—'}</p>
                </div>
                <div className="shrink-0 text-right text-sm text-[color:var(--color-ink-secondary)]">
                  <p>{vendor.email ?? '—'}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">{vendor.phone ?? '—'}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
