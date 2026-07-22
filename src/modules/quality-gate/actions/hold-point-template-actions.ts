'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getHoldPointTemplate,
  insertHoldPointTemplate,
  listHoldPointTemplates,
  updateHoldPointTemplate,
} from '../data/hold-point-templates-repository';
import { createHoldPointTemplateSchema, updateHoldPointTemplateSchema } from '../schemas';
import type { HoldPointTemplate } from '../types';

export const createHoldPointTemplateAction = safeAction(
  {
    schema: createHoldPointTemplateSchema,
    permission: { resource: 'hold_point_template', action: 'create' },
    loadContext: getActionContext,
    name: 'qualityGate.createHoldPointTemplate',
  },
  async (input, ctx): Promise<HoldPointTemplate> => {
    const supabase = await createServerSupabase();
    const template = await insertHoldPointTemplate(supabase, {
      organization_id: ctx.organizationId,
      work_type: input.workType,
      name: input.name,
      description: input.description ?? null,
      sort_order: input.sortOrder ?? 0,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'hold_point_templates',
      entityId: template.id,
      action: 'insert',
      newValue: template,
      requestId: ctx.requestId,
    });

    return template;
  },
);

export const updateHoldPointTemplateAction = safeAction(
  {
    schema: updateHoldPointTemplateSchema,
    permission: { resource: 'hold_point_template', action: 'update' },
    loadContext: getActionContext,
    name: 'qualityGate.updateHoldPointTemplate',
  },
  async (input, ctx): Promise<HoldPointTemplate> => {
    const supabase = await createServerSupabase();
    const before = await getHoldPointTemplate(supabase, input.id);

    const after = await updateHoldPointTemplate(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'hold_point_templates',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listHoldPointTemplatesAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'hold_point_template', action: 'view' },
    loadContext: getActionContext,
    name: 'qualityGate.listHoldPointTemplates',
  },
  async (): Promise<HoldPointTemplate[]> => {
    const supabase = await createServerSupabase();
    return listHoldPointTemplates(supabase);
  },
);
