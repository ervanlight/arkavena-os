'use client';

import { useMemo } from 'react';
import { useOutboxSync } from '@/core/offline/use-outbox-sync';
import type { SyncHandler } from '@/core/offline/types';

import {
  createDailyLogAction,
  createIssueAction,
  createMaterialRequestAction,
  createPhotoAction,
  createProgressEntryAction,
} from '@/modules/daily-report-inbox';
import { getUploadPresignedUrlAction } from '@/modules/daily-report-inbox/actions/r2-actions';

/**
 * Registers what the offline outbox (core/offline) replays each mutation
 * into, for all five field-reporting entities at once. Mounted once from
 * the (siteflow) layout so background sync runs regardless of which
 * six-button page the user happens to be on -- a photo queued from /site/foto
 * still syncs while the user is filling in /site/masalah, for instance.
 *
 * Every handler reconstructs the create input as `{ id: mutation.entityId,
 * ...mutation.fields }`: the outbox stores the id separately from the field
 * patch (core/offline/types.ts), and every create schema in this module
 * requires that same id, which is what makes a retried mutation upsert
 * instead of duplicating (FR6).
 */
export function OutboxSync(): null {
  const handlers = useMemo(() => {
    const map = new Map<string, SyncHandler>();

    map.set('daily_log', async (mutation) => {
      const result = await createDailyLogAction({ id: mutation.entityId, ...mutation.fields } as Parameters<
        typeof createDailyLogAction
      >[0]);
      return result.ok ? { ok: true } : { ok: false, error: result.error.message };
    });

    map.set('progress_entry', async (mutation) => {
      const result = await createProgressEntryAction({ id: mutation.entityId, ...mutation.fields } as Parameters<
        typeof createProgressEntryAction
      >[0]);
      return result.ok ? { ok: true } : { ok: false, error: result.error.message };
    });

    // A photo mutation carries the compressed bytes themselves (mainBlob/
    // thumbnailBlob), not just field values -- PhotoForm's own fallback
    // path queued it exactly because the upload-then-insert sequence
    // itself failed, so replaying it has to redo that whole sequence, not
    // just the row insert the other four handlers are content with.
    map.set('photo', async (mutation) => {
      const fields = mutation.fields as {
        projectId: string;
        zoneId: string;
        workPackageId?: string;
        caption?: string;
        storagePath: string;
        thumbnailPath: string;
        mainBlob: Blob;
        thumbnailBlob: Blob;
      };

      // Get presigned URL for main image and upload directly to R2
      const mainUrlResult = await getUploadPresignedUrlAction({ path: fields.storagePath, contentType: 'image/webp' });
      if (!mainUrlResult.ok) return { ok: false, error: mainUrlResult.error.message };
      
      const mainUploadRes = await fetch((mainUrlResult.data as { url: string }).url, {
        method: 'PUT',
        body: fields.mainBlob,
        headers: { 'Content-Type': 'image/webp' },
      });
      if (!mainUploadRes.ok) return { ok: false, error: 'Gagal mengunggah foto utama ke Cloudflare R2' };

      // Get presigned URL for thumbnail and upload directly to R2
      const thumbUrlResult = await getUploadPresignedUrlAction({ path: fields.thumbnailPath, contentType: 'image/webp' });
      if (!thumbUrlResult.ok) return { ok: false, error: thumbUrlResult.error.message };
      
      const thumbUploadRes = await fetch((thumbUrlResult.data as { url: string }).url, {
        method: 'PUT',
        body: fields.thumbnailBlob,
        headers: { 'Content-Type': 'image/webp' },
      });
      if (!thumbUploadRes.ok) return { ok: false, error: 'Gagal mengunggah thumbnail ke Cloudflare R2' };

      const result = await createPhotoAction({
        id: mutation.entityId,
        projectId: fields.projectId,
        zoneId: fields.zoneId,
        workPackageId: fields.workPackageId,
        caption: fields.caption,
        storagePath: fields.storagePath,
        thumbnailPath: fields.thumbnailPath,
        fileSizeBytes: fields.mainBlob.size,
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error.message };
    });

    map.set('material_request', async (mutation) => {
      const result = await createMaterialRequestAction({ id: mutation.entityId, ...mutation.fields } as Parameters<
        typeof createMaterialRequestAction
      >[0]);
      return result.ok ? { ok: true } : { ok: false, error: result.error.message };
    });

    map.set('issue', async (mutation) => {
      const result = await createIssueAction({ id: mutation.entityId, ...mutation.fields } as Parameters<
        typeof createIssueAction
      >[0]);
      return result.ok ? { ok: true } : { ok: false, error: result.error.message };
    });

    return map;
  }, []);

  useOutboxSync(handlers);

  return null;
}
