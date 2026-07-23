import {
  listPartnerDeliveriesForPurchaseOrderAction,
  listPartnerPurchaseOrdersAction,
  listPartnerVendorQuotesAction,
} from '@/modules/partner-desk';

export const metadata = { title: 'Partner Desk — BuildTrust OS' };

const QUOTE_STATUS_LABEL_ID: Record<string, string> = {
  received: 'Diterima',
  accepted: 'Disetujui',
  rejected: 'Ditolak',
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
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-slate-900">Penawaran &amp; Purchase Order Anda</h1>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Penawaran (quotes)</h2>
        {quotes.length === 0 && <p className="text-sm text-slate-500">Belum ada penawaran untuk proyek ini.</p>}
        {quotes.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Deskripsi</th>
                  <th className="px-4 py-2 font-medium">Nominal</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{quote.description}</td>
                    <td className="px-4 py-2 text-slate-600">Rp {quote.amount.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {QUOTE_STATUS_LABEL_ID[quote.status] ?? quote.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Purchase order &amp; pengiriman</h2>
        {purchaseOrders.length === 0 && <p className="text-sm text-slate-500">Belum ada purchase order untuk proyek ini.</p>}
        {purchaseOrders.length > 0 && (
          <div className="space-y-4">
            {purchaseOrders.map((po) => {
              const deliveriesResult = deliveriesByPo.get(po.id);
              const deliveries = deliveriesResult?.ok ? deliveriesResult.data : [];
              return (
                <div key={po.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{po.description}</p>
                    <p className="text-sm text-slate-600">Rp {po.amount.toLocaleString('id-ID')}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {deliveries.length === 0
                      ? 'Belum dikirim'
                      : `${deliveries.length} pengiriman tercatat, terakhir ${new Date(deliveries[0]!.delivered_at).toLocaleDateString('id-ID')}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
