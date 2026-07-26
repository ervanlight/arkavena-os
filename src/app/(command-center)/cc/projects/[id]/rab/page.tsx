
import { PageHeader, Card, EmptyState } from '@/core/ui';
import { getOfficialRab, getPendingVendorRabs } from '@/modules/partner-rab/data/admin-repository';
import { AdminRabReviewClient } from './AdminRabReviewClient';
import { AdminRabMarkupClient } from './AdminRabMarkupClient';

export const metadata = { title: 'RAB Proyek — Arkavena OS' };

export default async function CommandCenterProjectRabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const officialRab = await getOfficialRab(projectId);
  const pendingVendorRabs = await getPendingVendorRabs(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Rencana Anggaran Pelaksanaan (RAB)" />

      {/* Jika sudah ada RAB Resmi, tampilkan Markup Editor */}
      {officialRab && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">RAB Utama (Draft Pengajuan Klien)</h2>
            <p className="text-sm text-[color:var(--color-ink-secondary)]">
              RAB ini berasal dari pengajuan Subkon yang disetujui. Anda dapat menyesuaikan harga satuan jual (Markup) sebelum dikirim ke Klien.
            </p>
          </div>
          <AdminRabMarkupClient estimate={officialRab} />
        </Card>
      )}

      {/* Jika tidak ada RAB Resmi, atau jika ingin melihat pengajuan masuk, tampilkan list Pending Vendor Quotes */}
      {!officialRab && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">Pengajuan RAB dari Subkontraktor</h2>
          
          {pendingVendorRabs.length === 0 ? (
            <EmptyState 
              title="Belum ada RAB" 
              description="Belum ada pengajuan RAB dari Subkontraktor untuk proyek ini." 
            />
          ) : (
            pendingVendorRabs.map(quote => (
              <AdminRabReviewClient key={quote.id} quote={quote} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
