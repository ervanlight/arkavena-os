import { listHandoverItemsForProjectAction, listWarrantiesForProjectAction } from '@/modules/maintenance-engine';
import { Card, EmptyState } from '@/core/ui';
import { CreateHandoverItemForm } from './handover-item-form';

export const metadata = { title: 'Handover & Garansi — Arkavena OS' };

const WARRANTY_STATUS_LABEL_ID: Record<string, string> = {
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  claimed: 'Diklaim',
};

export default async function ProjectHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [itemsResult, warrantiesResult] = await Promise.all([
    listHandoverItemsForProjectAction(id),
    listWarrantiesForProjectAction(id),
  ]);
  const items = itemsResult.ok ? itemsResult.data : [];
  const warranties = warrantiesResult.ok ? warrantiesResult.data : [];

  return (
    <div className="space-y-8">
      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Item handover</h2>
        {items.length === 0 && <EmptyState title="Belum ada item handover." />}
        {items.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{item.item_type}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">{item.description ?? '—'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-[color:var(--color-ink-secondary)]">{item.handed_over_to ?? '—'}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    {item.handed_over_at !== null ? new Date(item.handed_over_at).toLocaleDateString('id-ID') : '—'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-[var(--radius-control)] border border-dashed border-[color:var(--color-hairline)] p-4">
          <CreateHandoverItemForm projectId={id} />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Garansi</h2>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Garansi dibuat otomatis saat proyek ditandai selesai, untuk setiap item handover yang membutuhkannya.
        </p>
        {warranties.length === 0 && <EmptyState title="Belum ada garansi." />}
        {warranties.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {warranties.map((warranty) => (
              <li key={warranty.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{warranty.title}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    {warranty.starts_at} — {warranty.ends_at}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-[color:var(--color-ink-secondary)]">
                  {WARRANTY_STATUS_LABEL_ID[warranty.status] ?? warranty.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
