import { Users } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Subkontraktor — Arkavena OS' };

export default function SubcontractorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Direktori Subkontraktor</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Kelola mitra kerja, rilis Work Order, tinjau performa, dan kontrol pengajuan RAB.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-purple-600" />
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">PT Mandiri Beton</h2>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
              Aktif di 2 Proyek
            </span>
          </div>
          <p className="text-xs text-[color:var(--color-ink-secondary)]">
            Spesialisasi: Pekerjaan Struktur &amp; Pembetonan.
          </p>
          <div className="flex justify-between items-center pt-2 text-xs border-t border-[color:var(--color-hairline)]">
            <span className="text-[color:var(--color-ink-tertiary)]">Laporan Harian Tepat Waktu: 98%</span>
            <button className="rounded-lg border border-[color:var(--color-hairline)] px-2.5 py-1 font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
              Lihat Detail SPK
            </button>
          </div>
        </Card>

        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">PT Surya Teknik</h2>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
              Aktif di 1 Proyek
            </span>
          </div>
          <p className="text-xs text-[color:var(--color-ink-secondary)]">
            Spesialisasi: MEP (Mechanical, Electrical, Plumbing).
          </p>
          <div className="flex justify-between items-center pt-2 text-xs border-t border-[color:var(--color-hairline)]">
            <span className="text-[color:var(--color-ink-tertiary)]">Laporan Harian Tepat Waktu: 95%</span>
            <button className="rounded-lg border border-[color:var(--color-hairline)] px-2.5 py-1 font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
              Lihat Detail SPK
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
