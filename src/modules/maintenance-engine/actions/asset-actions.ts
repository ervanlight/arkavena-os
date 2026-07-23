'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getSiteAction } from '@/modules/crm';
import { getAsset, insertAsset, listAssets, listAssetsForSite, updateAsset } from '../data/assets-repository';
import { createAssetSchema, updateAssetSchema } from '../schemas';
import type { Asset } from '../types';

export const createAssetAction = safeAction(
  {
    schema: createAssetSchema,
    permission: { resource: 'asset', action: 'create' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.createAsset',
  },
  async (input, ctx): Promise<Asset> => {
    const supabase = await createServerSupabase();

    const siteResult = await getSiteAction(input.siteId);
    if (!siteResult.ok) {
      throw new Error(`Failed to load site while creating asset: ${siteResult.error.message}`);
    }

    const asset = await insertAsset(supabase, {
      organization_id: ctx.organizationId,
      site_id: input.siteId,
      client_id: siteResult.data.client_id,
      name: input.name,
      category: input.category ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      serial_number: input.serialNumber ?? null,
      install_date: input.installDate ?? null,
      warranty_id: input.warrantyId ?? null,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'assets',
      entityId: asset.id,
      action: 'insert',
      newValue: asset,
      requestId: ctx.requestId,
    });

    return asset;
  },
);

export const updateAssetAction = safeAction(
  {
    schema: updateAssetSchema,
    permission: { resource: 'asset', action: 'update' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.updateAsset',
  },
  async (input, ctx): Promise<Asset> => {
    const supabase = await createServerSupabase();
    const before = await getAsset(supabase, input.id);

    const after = await updateAsset(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.serialNumber !== undefined ? { serial_number: input.serialNumber } : {}),
      ...(input.installDate !== undefined ? { install_date: input.installDate } : {}),
      ...(input.warrantyId !== undefined ? { warranty_id: input.warrantyId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'assets',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listAssetsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'asset', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listAssets',
  },
  async (): Promise<Asset[]> => {
    const supabase = await createServerSupabase();
    return listAssets(supabase);
  },
);

export const listAssetsForSiteAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'asset', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listAssetsForSite',
  },
  async (siteId): Promise<Asset[]> => {
    const supabase = await createServerSupabase();
    return listAssetsForSite(supabase, siteId);
  },
);

export const getAssetAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'asset', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.getAsset',
  },
  async (id): Promise<Asset> => {
    const supabase = await createServerSupabase();
    return getAsset(supabase, id);
  },
);
