'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { createProjectAction, type Project } from '@/modules/projects';
import { getLead, insertLead, listLeads, updateLead } from '../data/leads-repository';
import { insertClient } from '../data/clients-repository';
import { insertSite } from '../data/sites-repository';
import { convertLeadToProjectSchema, createLeadSchema, updateLeadStatusSchema } from '../schemas';
import type { Lead } from '../types';

export const createLeadAction = safeAction(
  {
    schema: createLeadSchema,
    permission: { resource: 'lead', action: 'create' },
    loadContext: getActionContext,
    name: 'crm.createLead',
  },
  async (input, ctx): Promise<Lead> => {
    const supabase = await createServerSupabase();
    const lead = await insertLead(supabase, {
      organization_id: ctx.organizationId,
      client_id: input.clientId ?? null,
      contact_name: input.contactName,
      email: input.email === '' ? null : (input.email ?? null),
      phone: input.phone ?? null,
      source: input.source ?? null,
      budget_known: input.budgetKnown ?? false,
      desired_start_date: input.desiredStartDate ?? null,
      estimated_value: input.estimatedValue !== undefined ? toRupiah(input.estimatedValue) : null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'leads',
      entityId: lead.id,
      action: 'insert',
      newValue: lead,
      requestId: ctx.requestId,
    });

    return lead;
  },
);

export const listLeadsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'lead', action: 'view' },
    loadContext: getActionContext,
    name: 'crm.listLeads',
  },
  async (): Promise<Lead[]> => {
    const supabase = await createServerSupabase();
    return listLeads(supabase);
  },
);

export const getLeadAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'lead', action: 'view' },
    loadContext: getActionContext,
    name: 'crm.getLead',
  },
  async (id): Promise<Lead> => {
    const supabase = await createServerSupabase();
    return getLead(supabase, id);
  },
);

/**
 * The trigger-enforced graph (fn_leads_guard_transition, ADR 0018) is what
 * actually holds regardless of what this action's own input allows through --
 * this only carries `lost_reason` alongside the status change, and lets the
 * database's own exception surface if the transition itself is illegal.
 */
export const updateLeadStatusAction = safeAction(
  {
    schema: updateLeadStatusSchema,
    permission: { resource: 'lead', action: 'update' },
    loadContext: getActionContext,
    name: 'crm.updateLeadStatus',
  },
  async (input, ctx): Promise<Lead> => {
    const supabase = await createServerSupabase();
    const before = await getLead(supabase, input.id);

    const after = await updateLead(supabase, input.id, {
      status: input.status,
      ...(input.lostReason !== undefined ? { lost_reason: input.lostReason } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'leads',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/**
 * Creates (or attaches to an existing) client + site + a `projects` row in
 * `planning` status, then stores the result back on the lead (ADR 0018 SS2).
 * Reuses modules/projects' own createProjectAction rather than reaching into
 * its repository directly (ARCHITECTURE.md 1.2) -- client-portal and billing
 * already established this "another module's public API, not its internals"
 * pattern for a cross-module write, not just a read.
 */
export const convertLeadToProjectAction = safeAction(
  {
    schema: convertLeadToProjectSchema,
    permission: { resource: 'lead', action: 'convert' },
    loadContext: getActionContext,
    name: 'crm.convertLeadToProject',
  },
  async (input, ctx): Promise<Project> => {
    const supabase = await createServerSupabase();
    const lead = await getLead(supabase, input.leadId);

    if (lead.status !== 'qualified') {
      throw new DomainRuleError(
        ERROR_CODES.LEAD_NOT_QUALIFIED,
        `Lead ${lead.id} is status ${lead.status}, not qualified`,
        { meta: { leadId: lead.id, status: lead.status } },
      );
    }

    const clientId =
      input.clientId ??
      (
        await insertClient(supabase, {
          organization_id: ctx.organizationId,
          name: input.newClientName!,
          contact_name: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
        })
      ).id;

    const siteId =
      input.siteId ??
      (
        await insertSite(supabase, {
          organization_id: ctx.organizationId,
          client_id: clientId,
          name: input.newSiteName!,
          address: input.newSiteAddress ?? null,
        })
      ).id;

    const projectResult = await createProjectAction({ clientId, siteId, name: input.projectName });
    if (!projectResult.ok) {
      throw new Error(`Failed to create project while converting lead ${lead.id}: ${projectResult.error.message}`);
    }

    const updatedLead = await updateLead(supabase, lead.id, { project_id: projectResult.data.id });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'leads',
      entityId: updatedLead.id,
      action: 'update',
      previousValue: lead,
      newValue: updatedLead,
      projectId: projectResult.data.id,
      requestId: ctx.requestId,
    });

    return projectResult.data;
  },
);
