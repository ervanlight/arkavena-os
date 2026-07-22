'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { invoiceAgingTier, type InvoiceAgingTier } from '../domain/invoice-aging';
import { listIssuedUnpaidInvoices } from '../data/invoices-repository';
import type { Invoice } from '../types';

export type AgingDashboardRow = Invoice & { agingTier: InvoiceAgingTier };

/** Every issued, not-fully-paid invoice across the org, with its aging tier attached -- the Billing aging dashboard's one query (ARCHITECTURE.md 7). */
export const listAgingDashboardAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'invoice', action: 'view' },
    loadContext: getActionContext,
    name: 'billing.listAgingDashboard',
  },
  async (): Promise<AgingDashboardRow[]> => {
    const supabase = await createServerSupabase();
    const invoices = await listIssuedUnpaidInvoices(supabase);
    const now = Date.now();
    return invoices.map((invoice) => ({
      ...invoice,
      agingTier: invoiceAgingTier(new Date(invoice.due_date).getTime(), now),
    }));
  },
);
