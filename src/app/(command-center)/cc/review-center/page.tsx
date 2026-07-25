import { FileText, Image as ImageIcon } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Review Center — Arkavena OS' };

export default function ReviewCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Review Center</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Pusat peninjauan tunggal Arkavena PM untuk RAB Subkontraktor, Foto QC, dan Klaim Pekerjaan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-3">
          <div className="flex items-center gap-2.5 text-blue-600">
            <FileText size={18} />
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">RAB Subkontraktor Pending</h2>
          </div>
          <p className="text-xs text-[color:var(--color-ink-secondary)]">
            Penawaran harga tambah titik lampu &amp; stop kontak dari Subkontraktor Listrik (PT Surya Teknik).
          </p>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs font-semibold text-[color:var(--color-ink)]">HPP: Rp 4.500.000</span>
            <button className="rounded-lg bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium text-white">
              Tinjau &amp; Atur Margin
            </button>
          </div>
        </Card>

        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-3">
          <div className="flex items-center gap-2.5 text-green-600">
            <ImageIcon size={18} />
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">Bukti Foto &amp; QC Field</h2>
          </div>
          <p className="text-xs text-[color:var(--color-ink-secondary)]">
            5 Foto bukti pemasangan batu alam area fasad depan dari Mandiri Batu Utama.
          </p>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-[color:var(--color-ink-tertiary)]">Diunggah: Hari ini 14:20</span>
            <button className="rounded-lg border border-[color:var(--color-hairline)] px-3 py-1 text-xs font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
              Periksa QC
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
