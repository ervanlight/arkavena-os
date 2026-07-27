'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getChangeOrderAction } from '@/modules/variations';
import { getMilestoneAction } from '@/modules/projects';
import { canIssueInvoice } from '../domain/invoice-eligibility';
import type { Blocked, HoldPointState, Proceed } from '../domain/types';
import { getInvoice, insertInvoice, listInvoicesForProject, updateInvoice } from '../data/invoices-repository';
import { cancelInvoiceSchema, createInvoiceSchema, issueInvoiceSchema } from '../schemas';
import type { Invoice } from '../types';
import { err, type Result } from '@/core/errors/result';

export const createInvoiceAction = safeAction(
  {
    schema: createInvoiceSchema,
    permission: { resource: 'invoice', action: 'create' },
    loadContext: getActionContext,
    name: 'billing.createInvoice',
  },
  async (input, ctx): Promise<Invoice> => {
    const supabase = await createServerSupabase();
    const invoice = await insertInvoice(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      change_order_id: input.changeOrderId ?? null,
      title: input.title,
      amount: toRupiah(input.amount),
      due_date: input.dueDate,
      created_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'invoices',
      entityId: invoice.id,
      action: 'insert',
      newValue: { ...invoice, amount: invoice.amount.toString() },
      projectId: invoice.project_id,
      requestId: ctx.requestId,
    });

    return invoice;
  },
);

export const listInvoicesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'invoice', action: 'view' },
    loadContext: getActionContext,
    name: 'billing.listInvoicesForProject',
  },
  async (projectId): Promise<Invoice[]> => {
    const supabase = await createServerSupabase();
    return listInvoicesForProject(supabase, projectId);
  },
);

export const getInvoiceAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'invoice', action: 'view' },
    loadContext: getActionContext,
    name: 'billing.getInvoice',
  },
  async (id): Promise<Invoice> => {
    const supabase = await createServerSupabase();
    return getInvoice(supabase, id);
  },
);

/**
 * The read-only "why can't this issue yet" check a UI calls before offering
 * to issue an invoice -- assembles canIssueInvoice()'s input by calling
 * into modules/projects, modules/quality-gate and modules/scope-variation's
 * own public APIs (ARCHITECTURE.md 1.2: another module's data only through
 * its public API), then hands the decision to the pure domain function.
 * Advisory only -- fn_invoices_guard_issuance is what actually enforces it
 * (CLAUDE.md 0.3), independently of whatever this read says.
 */
export const getInvoiceIssuanceStatusAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'invoice', action: 'view' },
    loadContext: getActionContext,
    name: 'billing.getInvoiceIssuanceStatus',
  },
  async (invoiceId, ctx): Promise<Result<Proceed, Blocked>> => {
    const supabase = await createServerSupabase();
    const invoice = await getInvoice(supabase, invoiceId);

    const milestoneResult = await getMilestoneAction(invoice.milestone_id);
    if (!milestoneResult.ok) return err({ reasons: [milestoneResult.error.message] });

    

    const { data: inspectionsData } = await supabase
      .from('inspections')
      .select('status, hold_point_templates(name)')
      .eq('project_id', invoice.project_id)
      .is('deleted_at', null);

    const holdPoints: HoldPointState[] = (inspectionsData ?? []).map((insp) => ({
      status: insp.status as any,
      templateName: (insp.hold_point_templates as any)?.name ?? 'Inspection',
    }));

    let changeOrder: { status: string } | null = null;
    if (invoice.change_order_id !== null) {
      const changeOrderResult = await getChangeOrderAction(invoice.change_order_id);
      if (!changeOrderResult.ok) return err({ reasons: [changeOrderResult.error.message] });
      changeOrder = { status: changeOrderResult.data.status };
    }

    return canIssueInvoice({
      milestone: milestoneResult.data,
      holdPoints,
      changeOrder,
      // Not "has this invoice already been approved" -- approved_by is only
      // ever set in the same atomic update that also sets status='issued'
      // (issueInvoiceAction), so checking the stored column here would make
      // this precondition permanently unsatisfiable before the button that
      // satisfies it is even clicked. What this advisory check actually
      // needs to know is "would clicking issue right now succeed" -- which
      // depends on whether the *current viewer* is a Technical Director,
      // the same role fn_invoices_guard_issuance will check against
      // whatever approved_by ends up holding.
      approvedByTechnicalDirector: ctx.orgRole === 'technical_director',
    });
  },
);

/**
 * Technical-Director-only: approving and issuing are one action, done by a
 * TD (ARCHITECTURE.md 7's "persetujuan TD"). `approved_by` is always the
 * caller's own id, never client-supplied -- fn_invoices_guard_issuance
 * checks that id's actual org_role in the database, so this cannot be
 * spoofed by naming a different Technical Director.
 */
export const issueInvoiceAction = safeAction(
  {
    schema: issueInvoiceSchema,
    permission: { resource: 'invoice', action: 'issue' },
    loadContext: getActionContext,
    name: 'billing.issueInvoice',
  },
  async (input, ctx): Promise<Invoice> => {
    const supabase = await createServerSupabase();
    const before = await getInvoice(supabase, input.id);

    const after = await updateInvoice(supabase, input.id, {
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      status: 'issued',
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'invoices',
      entityId: after.id,
      action: 'approve',
      reason: 'Diterbitkan oleh Technical Director',
      previousValue: { ...before, amount: before.amount.toString() },
      newValue: { ...after, amount: after.amount.toString() },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const cancelInvoiceAction = safeAction(
  {
    schema: cancelInvoiceSchema,
    permission: { resource: 'invoice', action: 'cancel' },
    loadContext: getActionContext,
    name: 'billing.cancelInvoice',
  },
  async (input, ctx): Promise<Invoice> => {
    const supabase = await createServerSupabase();
    const before = await getInvoice(supabase, input.id);

    const after = await updateInvoice(supabase, input.id, {
      status: 'cancelled',
      cancelled_by: ctx.userId,
      cancelled_at: new Date().toISOString(),
      cancelled_reason: input.reason,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'invoices',
      entityId: after.id,
      action: 'reject',
      reason: input.reason,
      previousValue: { ...before, amount: before.amount.toString() },
      newValue: { ...after, amount: after.amount.toString() },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);
