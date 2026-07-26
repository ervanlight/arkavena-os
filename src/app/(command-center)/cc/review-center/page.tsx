import { PageHeader, EmptyState } from '@/core/ui';
import { listPendingInboxItemsAction } from '@/modules/review-center';
import { InboxList } from './_components/inbox-list';
import { Inbox } from 'lucide-react';

export const metadata = { title: 'Review Center — Arkavena OS' };

export default async function ReviewCenterPage() {
  const result = await listPendingInboxItemsAction({});
  const items = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Review Center" 
        subtitle="Satu pintu untuk semua pengajuan persetujuan dari Subkontraktor dan Koordinator Lapangan." 
      />

      {items.length === 0 ? (
        <EmptyState 
          icon={<Inbox size={48} className="text-[color:var(--color-ink-tertiary)]" />}
          title="Inbox Kosong" 
          description="Bagus! Tidak ada keputusan yang tertunda. Semua pengajuan telah ditinjau." 
        />
      ) : (
        <InboxList initialItems={items} />
      )}
    </div>
  );
}
