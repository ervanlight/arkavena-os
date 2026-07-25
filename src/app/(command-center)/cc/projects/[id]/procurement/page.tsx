import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import {
  listDeliveriesForPurchaseOrderAction,
  listPurchaseOrdersForProjectAction,
  listVendorQuotesForProjectAction,
  listVendorsAction,
} from '@/modules/procurement';
import { listMaterialRequestsForProjectAction } from '@/modules/field-reporting';
import { Card, EmptyState, StatusBadge } from '@/core/ui';
import { CreateVendorQuoteForm } from './vendor-quote-form';
import { CreatePurchaseOrderForm } from './purchase-order-form';
import { OverridePurchaseOrderForm } from './override-purchase-order-form';
import { CreateDeliveryForm } from './delivery-form';
import { QuoteSummaryWidget } from './quote-summary-widget';

export const metadata = { title: 'Prokuremen — Arkavena OS' };

const QUOTE_STATUS_LABEL_ID: Record<string, string> = {
  received: 'Diterima',
  accepted: 'Disetujui',
  rejected: 'Ditolak',
};

const QUOTE_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  received: 'info',
  accepted: 'success',
  rejected: 'danger',
};

export default async function ProjectProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [user, vendorsResult, quotesResult, purchaseOrdersResult, materialRequestsResult] = await Promise.all([
    getCurrentUser(),
    listVendorsAction(undefined),
    listVendorQuotesForProjectAction(id),
    listPurchaseOrdersForProjectAction(id),
    listMaterialRequestsForProjectAction(id),
  ]);

  const vendors = vendorsResult.ok ? vendorsResult.data : [];
  const quotes = quotesResult.ok ? quotesResult.data : [];
  const purchaseOrders = purchaseOrdersResult.ok ? purchaseOrdersResult.data : [];
  // Phase 3 (F9): only requests still awaiting fulfillment are worth picking
  // from here -- once a PO links one, fn_purchase_orders_sync_material_request_status
  // already flips it to 'fulfilled', so it drops out of this list on its own.
  const openMaterialRequests = (materialRequestsResult.ok ? materialRequestsResult.data : []).filter(
    (request) => request.status === 'requested',
  );
  const canOverride = roleCan(user?.orgRole ?? null, 'cash_gate_override', 'create');

  const deliveriesByPo = new Map<string, Awaited<ReturnType<typeof listDeliveriesForPurchaseOrderAction>>>();
  await Promise.all(
    purchaseOrders.map(async (po) => {
      deliveriesByPo.set(po.id, await listDeliveriesForPurchaseOrderAction(po.id));
    }),
  );

  return (
    <div className="space-y-8">
      <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Prokuremen</h2>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Penawaran vendor (vendor quotes)</h2>
        {quotes.length === 0 && <EmptyState title="Belum ada penawaran vendor" />}
        {quotes.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {quotes.map((quote) => (
              <li key={quote.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{quote.description}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Rp {quote.amount.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge tone={QUOTE_STATUS_TONE[quote.status] ?? 'neutral'}>
                    {QUOTE_STATUS_LABEL_ID[quote.status] ?? quote.status}
                  </StatusBadge>
                  <QuoteSummaryWidget vendorQuoteId={quote.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <Card className="border border-dashed border-[color:var(--color-hairline)] shadow-none">
          <CreateVendorQuoteForm projectId={id} vendors={vendors} />
        </Card>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Purchase order</h2>
        {purchaseOrders.length === 0 && <EmptyState title="Belum ada purchase order" />}
        {purchaseOrders.length > 0 && (
          <div className="space-y-3">
            {purchaseOrders.map((po) => {
              const deliveriesResult = deliveriesByPo.get(po.id);
              const deliveries = deliveriesResult?.ok ? deliveriesResult.data : [];
              return (
                <Card key={po.id} className="border border-[color:var(--color-hairline)] shadow-none">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-[color:var(--color-ink)]">{po.description}</p>
                    <p className="text-sm text-[color:var(--color-ink-secondary)]">
                      Rp {po.amount.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--color-ink-tertiary)]">
                    {deliveries.length} pengiriman tercatat
                  </p>
                  <div className="mt-3">
                    <CreateDeliveryForm purchaseOrderId={po.id} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <Card className="space-y-4 border border-dashed border-[color:var(--color-hairline)] shadow-none">
          <CreatePurchaseOrderForm projectId={id} vendors={vendors} quotes={quotes} materialRequests={openMaterialRequests} />
        </Card>
        {canOverride && (
          <Card className="space-y-4 border border-dashed border-[color:var(--color-warning)]/50 bg-[color:var(--color-warning)]/10 shadow-none">
            <h3 className="text-sm font-semibold text-[#a05a00]">Override Cash Gate (hanya Owner)</h3>
            <OverridePurchaseOrderForm projectId={id} vendors={vendors} quotes={quotes} />
          </Card>
        )}
      </Card>
    </div>
  );
}
