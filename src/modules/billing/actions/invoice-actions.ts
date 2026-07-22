'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getChangeOrderAction } from '@/modules/scope-variation';
import { getMilestoneAction, listWorkPackagesForProjectAction } from '@/modules/projects';
import { listHoldPointStatusForWorkPackageAction } from '@/modules/quality-gate';
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
  async (invoiceId): Promise<Result<Proceed, Blocked>> => {
    const supabase = await createServerSupabase();
    const invoice = await getInvoice(supabase, invoiceId);

    const milestoneResult = await getMilestoneAction(invoice.milestone_id);
    if (!milestoneResult.ok) return err({ reasons: [milestoneResult.error.message] });

    const workPackagesResult = await listWorkPackagesForProjectAction(invoice.project_id);
    const workPackages = workPackagesResult.ok
      ? workPackagesResult.data.filter((wp) => wp.milestone_id === invoice.milestone_id && wp.work_type !== null)
      : [];

    const holdPointResults = await Promise.all(
      workPackages.map((wp) => listHoldPointStatusForWorkPackageAction(wp.id)),
    );
    const holdPoints: HoldPointState[] = holdPointResults.flatMap((result) =>
      result.ok
        ? result.data.map((status) => ({
            templateName: status.template.name,
            passed: status.inspection?.status === 'passed',
            overridden: status.inspection?.overridden_by != null,
          }))
        : [],
    );

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
      approvedByTechnicalDirector: invoice.approved_by !== null,
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
