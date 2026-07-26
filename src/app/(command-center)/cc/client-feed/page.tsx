import { ShieldAlert, FileText } from 'lucide-react';
import { Card } from '@/core/ui';
import { listAllClientStatusUpdatesAction } from '@/modules/client-feed';

export const metadata = { title: 'Client Feed — Arkavena OS' };

export default async function ClientFeedManagementPage() {
  const result = await listAllClientStatusUpdatesAction(undefined);
  const updates = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Client Feed Management</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Pantau tampilan feed yang terbit ke Klien. Data operasional internal diisolasi sepenuhnya.
        </p>
      </div>

      <Card className="border border-green-500/20 bg-green-500/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-green-600" size={20} />
          <p className="text-xs font-medium text-[color:var(--color-ink)]">
            <strong>Isolasi Data Aktif:</strong> Klien hanya melihat progres terkurasi. Pekerjaan internal, daftar pekerja, &amp; HPP terlindungi.
          </p>
        </div>
      </Card>

      <Card className="border border-[color:var(--color-hairline)] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">Feed Terpublikasi Lintas Proyek</h2>
        
        {updates.length === 0 ? (
          <div className="rounded-[12px] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-surface-secondary)]">
              <FileText size={24} className="text-[color:var(--color-ink-tertiary)]" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[color:var(--color-ink)]">Belum ada publikasi</h3>
            <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">
              Tidak ada feed yang dipublikasikan ke klien.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <div key={update.id} className="flex items-start justify-between border-b border-[color:var(--color-hairline)] pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-ink)]">{update.headline}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Proyek: {update.project_name} &middot; Diterbitkan: {new Date(update.published_at).toLocaleString('id-ID')}
                  </p>
                  {update.detail && (
                    <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)] line-clamp-2">
                      {update.detail}
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-500/10 px-2.5 py-0.5 rounded-full shrink-0">
                  Live di Klien
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
