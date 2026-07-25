import { Rss, Eye, ShieldAlert } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Client Feed — Arkavena OS' };

export default function ClientFeedManagementPage() {
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
        <button className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
          <Eye size={14} /> Preview Tampilan Klien
        </button>
      </Card>

      <Card className="border border-[color:var(--color-hairline)] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">Feed Terpublikasi Hari Ini</h2>
        <div className="space-y-3">
          <div className="flex items-start justify-between border-b border-[color:var(--color-hairline)] pb-3">
            <div>
              <p className="text-sm font-medium text-[color:var(--color-ink)]">Pengecoran Pelat Lantai 2 Selesai</p>
              <p className="text-xs text-[color:var(--color-ink-tertiary)]">Diterbitkan: 25 Jul 2026, 14:00 &middot; Dikurasi oleh: Budi (PM)</p>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-500/10 px-2.5 py-0.5 rounded-full">
              Live di Klien
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
