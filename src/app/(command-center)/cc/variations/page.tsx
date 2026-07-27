import Link from 'next/link';
import { GitPullRequest, DollarSign, Send } from 'lucide-react';
import { Card, EmptyState } from '@/core/ui';
import { listAllChangeOrdersAction } from '@/modules/variations';

export const metadata = { title: 'Variations — Arkavena OS' };

export default async function VariationsPage() {
  const result = await listAllChangeOrdersAction(undefined);
  const variations = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Variation Workflow Hub</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Kelola alur pekerjaan tambah/kurang: Permintaan Klien &rarr; RAB Subkontraktor &rarr; Penyesuaian Harga Jual &rarr; Proposal Addendum &rarr; Work Order.
        </p>
      </div>

      {variations.length === 0 ? (
        <EmptyState
          title="Belum ada Variation Order"
          description="Tidak ada pekerjaan tambah/kurang (VO) yang sedang berjalan di proyek mana pun."
        />
      ) : (
        <div className="space-y-4">
          {variations.map((vo) => (
            <Card key={vo.id} className="border border-[color:var(--color-hairline)] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[color:var(--color-hairline)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                    <GitPullRequest size={20} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[color:var(--color-ink)]">{vo.title}</p>
                    <p className="text-xs text-[color:var(--color-ink-tertiary)]">Proyek: {vo.project_name}</p>
                  </div>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 uppercase">
                  {vo.status.replace(/_/g, ' ')}
                </span>
              </div>

              {vo.description && (
                <p className="text-sm text-[color:var(--color-ink-secondary)] line-clamp-3">
                  {vo.description}
                </p>
              )}

              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Link
                    href={`/cc/projects/${vo.project_id}/variations/${vo.id}`}
                    className="flex items-center gap-2 rounded-lg bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-surface)] hover:bg-[color:var(--color-ink-secondary)] transition-colors"
                  >
                    <DollarSign size={16} /> Kalkulasi HPP
                  </Link>
                  <Link
                    href={`/cc/projects/${vo.project_id}/variations/${vo.id}`}
                    className="flex items-center gap-2 rounded-lg border border-[color:var(--color-hairline)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-secondary)] transition-colors"
                  >
                    <Send size={16} /> Detail & Pengajuan
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
