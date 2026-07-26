/**
 * Public API of modules/partner-desk (Fase 11, ADR 0024). The only door
 * other modules and app/ may use to reach the vw_partner_* views -- nothing
 * under data/ or actions/ is ever imported directly from outside this
 * folder.
 *
 * Read-only by design (ADR 0024 SS3): suppliers see their own
 * quotes/purchase-orders/deliveries, nothing here writes anything. Vendor
 * onboarding (inviteVendorUserAction) lives in modules/procurement, since it
 * owns vendor_users.
 */

export type { PartnerDelivery, PartnerPurchaseOrder, PartnerVendorQuote } from './types';

export {
  listPartnerDeliveriesForPurchaseOrderAction,
  listPartnerPurchaseOrdersAction,
  listPartnerVendorQuotesAction,
} from './actions/partner-desk-actions';

export { listVendorsAction } from './actions/vendor-actions';
