'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getInvoice } from '../data/invoices-repository';
import { insertPayment, listPaymentsForInvoice } from '../data/payments-repository';
import { recordPaymentSchema } from '../schemas';
import type { Payment } from '../types';

export const recordPaymentAction = safeAction(
  {
    schema: recordPaymentSchema,
    permission: { resource: 'payment', action: 'create' },
    loadContext: getActionContext,
    name: 'billing.recordPayment',
  },
  async (input, ctx): Promise<Payment> => {
    const supabase = await createServerSupabase();
    // organization_id is not caller-supplied -- taken from the invoice, so a
    // payment can never be recorded against another organisation's invoice
    // even if the client-side form were tampered with.
    const invoice = await getInvoice(supabase, input.invoiceId);

    const payment = await insertPayment(supabase, {
      organization_id: invoice.organization_id,
      invoice_id: input.invoiceId,
      amount: toRupiah(input.amount),
      proof_path: input.proofPath ?? null,
      recorded_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'payments',
      entityId: payment.id,
      action: 'insert',
      newValue: { ...payment, amount: payment.amount.toString() },
      projectId: invoice.project_id,
      requestId: ctx.requestId,
    });

    return payment;
  },
);

export const listPaymentsForInvoiceAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'payment', action: 'view' },
    loadContext: getActionContext,
    name: 'billing.listPaymentsForInvoice',
  },
  async (invoiceId): Promise<Payment[]> => {
    const supabase = await createServerSupabase();
    return listPaymentsForInvoice(supabase, invoiceId);
  },
);
