import { Inbox, Check, X, RotateCcw } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Daily Report Inbox — Arkavena OS' };

export default function DailyReportInboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Daily Report Inbox</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Tinjau laporan harian dari subkontraktor sebelum dikurasi &amp; dipublikasikan ke Client Feed.
        </p>
      </div>

      <Card className="border border-[color:var(--color-hairline)] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[color:var(--color-hairline)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Inbox size={20} />
            </div>
            <div>
              <p className="text-base font-semibold text-[color:var(--color-ink)]">Laporan Pengecoran Pelat Lantai 2</p>
              <p className="text-xs text-[color:var(--color-ink-tertiary)]">Subkontraktor: PT Mandiri Beton &middot; Proyek Renovasi Rumah Tinggal</p>
            </div>
          </div>
          <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-600">
            Menunggu Review PM
          </span>
        </div>

        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Pekerjaan struktur lantai 2 telah rampung 100%. Pengujian slump tes beton K-300 sesuai spesifikasi.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink-secondary)] hover:bg-gray-100">
            <RotateCcw size={14} /> Minta Revisi
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20">
            <X size={14} /> Tolak
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-[color:var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--color-accent-hover)]">
            <Check size={14} /> Disetujui &amp; Terbitkan ke Klien
          </button>
        </div>
      </Card>
    </div>
  );
}
