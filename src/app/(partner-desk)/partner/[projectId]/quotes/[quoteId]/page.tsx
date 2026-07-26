import { notFound } from 'next/navigation';
import { Card, PageHeader } from '@/core/ui';
import { getVendorQuoteItems } from '@/modules/partner-rab/data/rab-repository';
import { listPartnerVendorQuotesAction } from '@/modules/subcontractors';
import { RabBuilderClient } from './RabBuilderClient';

export const metadata = { title: 'Isi RAB / BoQ — Arkavena OS' };

export default async function PartnerRabBuilderPage({
  params,
}: {
  params: Promise<{ projectId: string; quoteId: string }>;
}) {
  const { projectId, quoteId } = await params;

  // Validate if this quote belongs to the partner
  const quotesResult = await listPartnerVendorQuotesAction(projectId);
  if (!quotesResult.ok) return notFound();
  
  const quote = quotesResult.data.find((q) => q.id === quoteId);
  if (!quote) return notFound();

  // Load existing items
  const items = await getVendorQuoteItems(quoteId);

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`RAB: ${quote.description}`} 
      />

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">Rincian Anggaran Pelaksanaan</h2>
          <p className="text-sm text-[color:var(--color-ink-secondary)]">
            Silakan masukkan rincian pekerjaan, volume, dan harga satuan (HPP). Sistem akan otomatis menghitung total.
          </p>
        </div>

        <RabBuilderClient quoteId={quoteId} initialItems={items} />
      </Card>
    </div>
  );
}
