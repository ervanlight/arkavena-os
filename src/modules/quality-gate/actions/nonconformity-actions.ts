'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getNonconformity,
  insertNonconformity,
  listNonconformitiesForInspection,
  updateNonconformity,
} from '../data/nonconformities-repository';
import { createNonconformitySchema, resolveNonconformitySchema } from '../schemas';
import type { Nonconformity } from '../types';

export const createNonconformityAction = safeAction(
  {
    schema: createNonconformitySchema,
    permission: { resource: 'nonconformity', action: 'create' },
    loadContext: getActionContext,
    name: 'qualityGate.createNonconformity',
  },
  async (input, ctx): Promise<Nonconformity> => {
    const supabase = await createServerSupabase();
    const nonconformity = await insertNonconformity(supabase, {
      organization_id: ctx.organizationId,
      inspection_id: input.inspectionId,
      description: input.description,
      severity: input.severity ?? 'medium',
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'nonconformities',
      entityId: nonconformity.id,
      action: 'insert',
      newValue: nonconformity,
      requestId: ctx.requestId,
    });

    return nonconformity;
  },
);

export const resolveNonconformityAction = safeAction(
  {
    schema: resolveNonconformitySchema,
    permission: { resource: 'nonconformity', action: 'resolve' },
    loadContext: getActionContext,
    name: 'qualityGate.resolveNonconformity',
  },
  async (input, ctx): Promise<Nonconformity> => {
    const supabase = await createServerSupabase();
    const before = await getNonconformity(supabase, input.id);

    const after = await updateNonconformity(supabase, input.id, {
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'nonconformities',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listNonconformitiesForInspectionAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'nonconformity', action: 'view' },
    loadContext: getActionContext,
    name: 'qualityGate.listNonconformitiesForInspection',
  },
  async (inspectionId): Promise<Nonconformity[]> => {
    const supabase = await createServerSupabase();
    return listNonconformitiesForInspection(supabase, inspectionId);
  },
);
