'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getVendor, insertVendor, listVendors, updateVendor } from '../data/vendors-repository';
import { createVendorSchema, updateVendorSchema } from '../schemas';
import type { Vendor } from '../types';

export const createVendorAction = safeAction(
  {
    schema: createVendorSchema,
    permission: { resource: 'vendor', action: 'create' },
    loadContext: getActionContext,
    name: 'procurement.createVendor',
  },
  async (input, ctx): Promise<Vendor> => {
    const supabase = await createServerSupabase();
    const vendor = await insertVendor(supabase, {
      organization_id: ctx.organizationId,
      name: input.name,
      contact_name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'vendors',
      entityId: vendor.id,
      action: 'insert',
      newValue: vendor,
      requestId: ctx.requestId,
    });

    return vendor;
  },
);

export const updateVendorAction = safeAction(
  {
    schema: updateVendorSchema,
    permission: { resource: 'vendor', action: 'update' },
    loadContext: getActionContext,
    name: 'procurement.updateVendor',
  },
  async (input, ctx): Promise<Vendor> => {
    const supabase = await createServerSupabase();
    const before = await getVendor(supabase, input.id);

    const after = await updateVendor(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactName !== undefined ? { contact_name: input.contactName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'vendors',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listVendorsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'vendor', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.listVendors',
  },
  async (): Promise<Vendor[]> => {
    const supabase = await createServerSupabase();
    return listVendors(supabase);
  },
);

export const getVendorAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'vendor', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.getVendor',
  },
  async (id): Promise<Vendor> => {
    const supabase = await createServerSupabase();
    return getVendor(supabase, id);
  },
);
