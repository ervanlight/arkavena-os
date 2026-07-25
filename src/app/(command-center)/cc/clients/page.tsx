import Link from 'next/link';
import { listClientsAction } from '@/modules/crm';
import { Card, PageHeader, EmptyState } from '@/core/ui';

export const metadata = { title: 'Klien — Arkavena OS' };

export default async function ClientsPage() {
  const result = await listClientsAction(undefined);
  const clients = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klien"
        actions={
          <Link
            href="/cc/clients/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah klien
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && clients.length === 0 && <EmptyState title="Belum ada klien" description="Tambahkan klien pertama Anda." />}

      {clients.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {clients.map((client) => (
              <li key={client.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{client.name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">{client.contact_name ?? '—'}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-[color:var(--color-ink-tertiary)]">
                  <p>{client.email ?? '—'}</p>
                  <p>{client.phone ?? '—'}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
