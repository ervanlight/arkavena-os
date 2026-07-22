'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getPhoto, insertPhoto, listPhotosForProject, updatePhoto } from '../data/photos-repository';
import { createPhotoSchema, updatePhotoSchema } from '../schemas';
import type { Photo } from '../types';

/**
 * Records a photo row. The bytes are already in Supabase Storage by the
 * time this runs -- the browser uploads directly to the `photos` bucket
 * (RLS on `storage.objects`, FR2's migration), which is both how a
 * multi-megabyte file avoids a Server Action's request body, and how a
 * genuinely offline upload works at all: the outbox (core/offline) queues
 * the compressed blobs themselves, and only calls this action once the
 * upload has actually succeeded.
 */
export const createPhotoAction = safeAction(
  {
    schema: createPhotoSchema,
    permission: { resource: 'photo', action: 'create' },
    loadContext: getActionContext,
    name: 'fieldReporting.createPhoto',
  },
  async (input, ctx): Promise<Photo> => {
    const supabase = await createServerSupabase();
    const photo = await insertPhoto(supabase, {
      id: input.id,
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      zone_id: input.zoneId,
      work_package_id: input.workPackageId ?? null,
      daily_log_id: input.dailyLogId ?? null,
      storage_path: input.storagePath,
      thumbnail_path: input.thumbnailPath,
      file_size_bytes: input.fileSizeBytes,
      caption: input.caption ?? null,
      uploaded_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'photos',
      entityId: photo.id,
      action: 'insert',
      newValue: photo,
      projectId: photo.project_id,
      requestId: ctx.requestId,
    });

    return photo;
  },
);

export const updatePhotoAction = safeAction(
  {
    schema: updatePhotoSchema,
    permission: { resource: 'photo', action: 'update' },
    loadContext: getActionContext,
    name: 'fieldReporting.updatePhoto',
  },
  async (input, ctx): Promise<Photo> => {
    const supabase = await createServerSupabase();
    const before = await getPhoto(supabase, input.id);

    const after = await updatePhoto(supabase, input.id, {
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.workPackageId !== undefined ? { work_package_id: input.workPackageId } : {}),
      ...(input.dailyLogId !== undefined ? { daily_log_id: input.dailyLogId } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'photos',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listPhotosForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'photo', action: 'view' },
    loadContext: getActionContext,
    name: 'fieldReporting.listPhotosForProject',
  },
  async (projectId): Promise<Photo[]> => {
    const supabase = await createServerSupabase();
    return listPhotosForProject(supabase, projectId);
  },
);
