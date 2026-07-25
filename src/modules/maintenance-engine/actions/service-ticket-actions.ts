'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { getProjectClientId } from '@/modules/projects/server';
import { transition } from '../domain/service-ticket-transition';
import { getAsset } from '../data/assets-repository';
import {
  getServiceTicket,
  insertServiceTicket,
  listServiceTicketsForAsset,
  listServiceTicketsForClient,
  updateServiceTicket,
} from '../data/service-tickets-repository';
import { createServiceTicketAsClientSchema, createServiceTicketSchema, updateServiceTicketStatusSchema } from '../schemas';
import type { ServiceTicket } from '../types';

export const createServiceTicketAction = safeAction(
  {
    schema: createServiceTicketSchema,
    permission: { resource: 'service_ticket', action: 'create' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.createServiceTicket',
  },
  async (input, ctx): Promise<ServiceTicket> => {
    const supabase = await createServerSupabase();
    const asset = await getAsset(supabase, input.assetId);

    const ticket = await insertServiceTicket(supabase, {
      organization_id: ctx.organizationId,
      asset_id: input.assetId,
      client_id: asset.client_id,
      warranty_id: input.warrantyId ?? null,
      maintenance_plan_id: input.maintenancePlanId ?? null,
      title: input.title,
      description: input.description ?? null,
      // Opened by a person unless this came from a due maintenance plan
      // (ADR 0019 SS7), in which case there is no reporter to name.
      reported_by: input.maintenancePlanId === undefined ? ctx.userId : null,
      assigned_to: input.assignedTo ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'service_tickets',
      entityId: ticket.id,
      action: 'insert',
      newValue: ticket,
      requestId: ctx.requestId,
    });

    return ticket;
  },
);

/**
 * Phase 3 (F4): a client_approver reporting their own issue
 * (WORKFLOW_REVIEW.md 8.2's "duplicate entry" gap -- client calls the
 * office, staff re-keys it). Deliberately separate from
 * createServiceTicketAction above: no warrantyId/maintenancePlanId/
 * assignedTo input, status/reported_by/assigned_to/maintenance_plan_id/
 * warranty_id/resolved_at all fixed server-side to the one shape
 * service_tickets_insert_client RLS's own `with check` independently
 * requires (Phase 3 migration).
 */
export const createServiceTicketAsClientAction = safeAction(
  {
    schema: createServiceTicketAsClientSchema,
    permission: { resource: 'service_ticket', action: 'client_create' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.createServiceTicketAsClient',
    audience: 'external',
  },
  async (input, ctx): Promise<ServiceTicket> => {
    const supabase = await createServerSupabase();
    const asset = await getAsset(supabase, input.assetId);

    const ticket = await insertServiceTicket(supabase, {
      organization_id: asset.organization_id,
      asset_id: input.assetId,
      client_id: asset.client_id,
      title: input.title,
      description: input.description ?? null,
      reported_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'service_tickets',
      entityId: ticket.id,
      action: 'insert',
      newValue: ticket,
      requestId: ctx.requestId,
    });

    return ticket;
  },
);

/**
 * The domain layer's transition() decides first, turning an illegal move
 * into an ActionResult before any database write is attempted -- the same
 * two-layer split ADR 0018 established for leads. fn_service_tickets_guard_transition
 * mirrors the same graph underneath and is the real, unbypassable enforcement
 * either way. Setting resolved_at is server-side only, never client input
 * (same "server sets what the trail must trust" reasoning as
 * completeAssessmentAction).
 */
export const updateServiceTicketStatusAction = safeAction(
  {
    schema: updateServiceTicketStatusSchema,
    permission: { resource: 'service_ticket', action: 'update' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.updateServiceTicketStatus',
  },
  async (input, ctx): Promise<ServiceTicket> => {
    const supabase = await createServerSupabase();
    const before = await getServiceTicket(supabase, input.id);

    const decision = transition(before.status, input.status);
    if (!decision.ok) {
      throw new DomainRuleError(ERROR_CODES.SERVICE_TICKET_INVALID_TRANSITION, decision.error.reason, {
        userMessage: decision.error.reason,
      });
    }

    const after = await updateServiceTicket(supabase, input.id, {
      status: decision.value,
      ...(decision.value === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      ...(input.resolutionNotes !== undefined ? { resolution_notes: input.resolutionNotes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'service_tickets',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/** Phase 3 (F4): the Client Timeline's own read -- a client's own reported/tracked tickets, resolved via their project's client_id (modules/projects/server's getProjectClientId). */
export const listServiceTicketsForClientAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'service_ticket', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listServiceTicketsForClient',
    audience: 'external',
  },
  async (projectId): Promise<ServiceTicket[]> => {
    const supabase = await createServerSupabase();
    const clientId = await getProjectClientId(supabase, projectId);
    return listServiceTicketsForClient(supabase, clientId);
  },
);

export const listServiceTicketsForAssetAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'service_ticket', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listServiceTicketsForAsset',
  },
  async (assetId): Promise<ServiceTicket[]> => {
    const supabase = await createServerSupabase();
    return listServiceTicketsForAsset(supabase, assetId);
  },
);

export const getServiceTicketAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'service_ticket', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.getServiceTicket',
  },
  async (id): Promise<ServiceTicket> => {
    const supabase = await createServerSupabase();
    return getServiceTicket(supabase, id);
  },
);
