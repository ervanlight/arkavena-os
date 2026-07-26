import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). `amount` overridden to `Rupiah`, same pattern as every other money column in this codebase. */

export type Invoice = Omit<Tables<'invoices'>, 'amount'> & { amount: Rupiah };
export type NewInvoice = Omit<TablesInsert<'invoices'>, 'amount'> & { amount: Rupiah };
export type InvoiceUpdate = Omit<TablesUpdate<'invoices'>, 'amount'> & { amount?: Rupiah };

export type Payment = Omit<Tables<'payments'>, 'amount'> & { amount: Rupiah };
export type NewPayment = Omit<TablesInsert<'payments'>, 'amount'> & { amount: Rupiah };
