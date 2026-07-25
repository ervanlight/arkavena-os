import { GitPullRequest, DollarSign, Send } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Variations — Arkavena OS' };

export default function VariationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Variation Workflow Hub</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Kelola alur pekerjaan tambah/kurang: Permintaan Klien &rarr; RAB Subkontraktor &rarr; Penyesuaian Harga Jual &rarr; Proposal Addendum &rarr; Work Order.
        </p>
      </div>

      <Card className="border border-[color:var(--color-hairline)] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[color:var(--color-hairline)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <GitPullRequest size={20} />
            </div>
            <div>
              <p className="text-base font-semibold text-[color:var(--color-ink)]">VO-02: Penambahan Titik Lampu Fasad</p>
              <p className="text-xs text-[color:var(--color-ink-tertiary)]">Permintaan Klien &middot; Proyek Renovasi Rumah Tinggal</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600">
            Penyesuaian Harga Jual
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[color:var(--color-surface-secondary)] p-3 rounded-lg">
          <div>
            <span className="text-[color:var(--color-ink-tertiary)]">HPP Subkontraktor:</span>
            <p className="font-semibold text-[color:var(--color-ink)]">Rp 3.500.000</p>
          </div>
          <div>
            <span className="text-[color:var(--color-ink-tertiary)]">Margin Arkavena:</span>
            <p className="font-semibold text-green-600">20% (Rp 700.000)</p>
          </div>
          <div>
            <span className="text-[color:var(--color-ink-tertiary)]">Harga Jual Klien:</span>
            <p className="font-semibold text-[color:var(--color-ink)]">Rp 4.200.000</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
            <DollarSign size={14} /> Edit Selling Price
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-[color:var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--color-accent-hover)]">
            <Send size={14} /> Terbitkan Proposal Addendum ke Klien
          </button>
        </div>
      </Card>
    </div>
  );
}
