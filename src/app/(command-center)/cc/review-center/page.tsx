import { PageHeader, EmptyState } from '@/core/ui';
import { listPendingInboxItemsAction } from '@/modules/review-center';
import { InboxList } from './_components/inbox-list';


export const metadata = { title: 'Review Center — Arkavena OS' };

export default async function ReviewCenterPage() {
  const result = await listPendingInboxItemsAction({});
  const items = (result.ok ? result.data : []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Review Center" 
        subtitle="Satu pintu untuk semua pengajuan persetujuan dari Subkontraktor dan Koordinator Lapangan." 
      />
      {items.length === 0 ? (
        <EmptyState 
          title="Inbox Kosong" 
          description="Bagus! Tidak ada keputusan yang tertunda. Semua pengajuan telah ditinjau." 
        />
      ) : (
        <InboxList initialItems={items} />
      )}
    </div>
  );
}
