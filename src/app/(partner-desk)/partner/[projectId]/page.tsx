import {
  listPartnerDeliveriesForPurchaseOrderAction,
  listPartnerPurchaseOrdersAction,
  listPartnerVendorQuotesAction,
} from '@/modules/partner-desk';
import { Card, PageHeader, StatusBadge, EmptyState } from '@/core/ui';
import { formatRp, toRupiah } from '@/core/money/rupiah';

export const metadata = { title: 'Partner Desk — Arkavena OS' };

const QUOTE_STATUS_LABEL_ID: Record<string, string> = {
  received: 'Diterima',
  accepted: 'Disetujui',
  rejected: 'Ditolak',
};

const QUOTE_STATUS_TONE: Record<string, 'neutral' | 'success' | 'danger'> = {
  received: 'neutral',
  accepted: 'success',
  rejected: 'danger',
};

export default async function PartnerDeskProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [quotesResult, purchaseOrdersResult] = await Promise.all([
    listPartnerVendorQuotesAction(projectId),
    listPartnerPurchaseOrdersAction(projectId),
  ]);

  const quotes = quotesResult.ok ? quotesResult.data : [];
  const purchaseOrders = purchaseOrdersResult.ok ? purchaseOrdersResult.data : [];

  const deliveriesByPo = new Map<string, Awaited<ReturnType<typeof listPartnerDeliveriesForPurchaseOrderAction>>>();
  await Promise.all(
    purchaseOrders.map(async (po) => {
      deliveriesByPo.set(po.id, await listPartnerDeliveriesForPurchaseOrderAction(po.id));
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Penawaran & Purchase Order Anda" />

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Penawaran (quotes)</h2>
        {quotes.length === 0 && <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">Belum ada penawaran untuk proyek ini.</p>}
        {quotes.length > 0 && (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {quotes.map((quote) => (
              <li key={quote.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{quote.description}</p>
                  <p className="text-sm text-[color:var(--color-ink-secondary)]">{formatRp(toRupiah(quote.amount))}</p>
                </div>
                <StatusBadge tone={QUOTE_STATUS_TONE[quote.status] ?? 'neutral'}>
                  {QUOTE_STATUS_LABEL_ID[quote.status] ?? quote.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Purchase order &amp; pengiriman</h2>
        {purchaseOrders.length === 0 && (
          <EmptyState title="Belum ada purchase order" description="Belum ada purchase order untuk proyek ini." />
        )}
        {purchaseOrders.length > 0 && (
          <div className="mt-3 space-y-3">
            {purchaseOrders.map((po) => {
              const deliveriesResult = deliveriesByPo.get(po.id);
              const deliveries = deliveriesResult?.ok ? deliveriesResult.data : [];
              return (
                <div key={po.id} className="rounded-[var(--radius-control)] border border-[color:var(--color-hairline)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-[color:var(--color-ink)]">{po.description}</p>
                    <p className="text-sm text-[color:var(--color-ink-secondary)]">{formatRp(toRupiah(po.amount))}</p>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--color-ink-tertiary)]">
                    {deliveries.length === 0
                      ? 'Belum dikirim'
                      : `${deliveries.length} pengiriman tercatat, terakhir ${new Date(deliveries[0]!.delivered_at).toLocaleDateString('id-ID')}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
