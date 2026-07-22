/**
 * Public API of modules/billing. The only door other modules and app/ may
 * use to reach invoices or payments (ARCHITECTURE.md 1.2) -- one module
 * owns both tables (ARCHITECTURE.md 1.1).
 */

export type { Invoice, InvoiceUpdate, NewInvoice, NewPayment, Payment } from './types';
export type { Blocked, Proceed } from './domain/types';
export type { InvoiceAgingTier } from './domain/invoice-aging';
export type { AgingDashboardRow } from './actions/aging-dashboard-actions';
export type { BillingPack, BillingPackHoldPoint } from './actions/billing-pack-actions';

export {
  cancelInvoiceSchema,
  createInvoiceSchema,
  issueInvoiceSchema,
  recordPaymentSchema,
  type CancelInvoiceInput,
  type CreateInvoiceInput,
  type IssueInvoiceInput,
  type RecordPaymentInput,
} from './schemas';

export {
  cancelInvoiceAction,
  createInvoiceAction,
  getInvoiceAction,
  getInvoiceIssuanceStatusAction,
  issueInvoiceAction,
  listInvoicesForProjectAction,
} from './actions/invoice-actions';
export { listPaymentsForInvoiceAction, recordPaymentAction } from './actions/payment-actions';
export { listAgingDashboardAction } from './actions/aging-dashboard-actions';
export { getBillingPackAction } from './actions/billing-pack-actions';
