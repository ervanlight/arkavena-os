import { FileText, Download, Lock } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Dokumen Proyek — Arkavena OS' };

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Dokumen Proyek</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Pusat penyimpanan dokumen resmi (Kontrak, Addendum, Gambar Kerja, &amp; Sertifikat Garansi).
        </p>
      </div>

      <div className="space-y-3">
        <Card className="border border-[color:var(--color-hairline)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-ink)]">Kontrak Utama Pekerjaan Renovasi.pdf</p>
              <p className="text-xs text-[color:var(--color-ink-tertiary)]">Diunggah: 20 Jul 2026 &middot; Visibilitas: Klien &amp; Arkavena</p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
            <Download size={14} /> Unduh
          </button>
        </Card>

        <Card className="border border-[color:var(--color-hairline)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock size={20} className="text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-ink)]">SPK &amp; HPP Subkontraktor Listrik (Internal).pdf</p>
              <p className="text-xs text-[color:var(--color-ink-tertiary)]">Diunggah: 22 Jul 2026 &middot; Visibilitas: Internal Arkavena OS (Terisolasi dari Klien)</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
            Dokumen Internal
          </span>
        </Card>
      </div>
    </div>
  );
}
