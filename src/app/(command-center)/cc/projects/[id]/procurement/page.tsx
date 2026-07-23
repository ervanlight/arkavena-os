import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import {
  listDeliveriesForPurchaseOrderAction,
  listPurchaseOrdersForProjectAction,
  listVendorQuotesForProjectAction,
  listVendorsAction,
} from '@/modules/procurement';
import { CreateVendorQuoteForm } from './vendor-quote-form';
import { CreatePurchaseOrderForm } from './purchase-order-form';
import { OverridePurchaseOrderForm } from './override-purchase-order-form';
import { CreateDeliveryForm } from './delivery-form';
import { QuoteSummaryWidget } from './quote-summary-widget';

export const metadata = { title: 'Prokuremen — BuildTrust OS' };

const QUOTE_STATUS_LABEL_ID: Record<string, string> = {
  received: 'Diterima',
  accepted: 'Disetujui',
  rejected: 'Ditolak',
};

export default async function ProjectProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [user, vendorsResult, quotesResult, purchaseOrdersResult] = await Promise.all([
    getCurrentUser(),
    listVendorsAction(undefined),
    listVendorQuotesForProjectAction(id),
    listPurchaseOrdersForProjectAction(id),
  ]);

  const vendors = vendorsResult.ok ? vendorsResult.data : [];
  const quotes = quotesResult.ok ? quotesResult.data : [];
  const purchaseOrders = purchaseOrdersResult.ok ? purchaseOrdersResult.data : [];
  const canOverride = roleCan(user?.orgRole ?? null, 'cash_gate_override', 'create');

  const deliveriesByPo = new Map<string, Awaited<ReturnType<typeof listDeliveriesForPurchaseOrderAction>>>();
  await Promise.all(
    purchaseOrders.map(async (po) => {
      deliveriesByPo.set(po.id, await listDeliveriesForPurchaseOrderAction(po.id));
    }),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-slate-900">Prokuremen</h1>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Penawaran vendor (vendor quotes)</h2>
        {quotes.length === 0 && <p className="text-sm text-slate-500">Belum ada penawaran vendor.</p>}
        {quotes.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Deskripsi</th>
                  <th className="px-4 py-2 font-medium">Nominal</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
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
                    <td className="px-4 py-2">
                      <QuoteSummaryWidget vendorQuoteId={quote.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <CreateVendorQuoteForm projectId={id} vendors={vendors} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Purchase order</h2>
        {purchaseOrders.length === 0 && <p className="text-sm text-slate-500">Belum ada purchase order.</p>}
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
                    {deliveries.length} pengiriman tercatat
                  </p>
                  <div className="mt-3">
                    <CreateDeliveryForm purchaseOrderId={po.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-4 rounded-lg border border-dashed border-slate-300 p-4">
          <CreatePurchaseOrderForm projectId={id} vendors={vendors} quotes={quotes} />
        </div>
        {canOverride && (
          <div className="space-y-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">
              Override Cash Gate (hanya Owner)
            </h3>
            <OverridePurchaseOrderForm projectId={id} vendors={vendors} quotes={quotes} />
          </div>
        )}
      </div>
    </div>
  );
}
