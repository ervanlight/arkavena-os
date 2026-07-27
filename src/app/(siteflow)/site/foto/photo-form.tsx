'use client';

import { useActionState } from 'react';

import { compressPhoto } from '@/core/storage/compress-image';
import { photoStoragePath, photoThumbnailStoragePath } from '@/core/storage/paths';
import { createPhotoAction } from '@/modules/daily-report-inbox';
import { getUploadPresignedUrlAction } from '@/modules/daily-report-inbox/actions/r2-actions';
import { enqueueMutation } from '@/core/offline/outbox';
import { indexedDbOutboxStore } from '@/core/offline/indexeddb-store';
import { Card, Button, Input, Select, Label } from '@/core/ui';

type Zone = { id: string; name: string };
type WorkPackage = { id: string; name: string };

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Unlike the other four six-button forms, a photo's offline fallback has to
 * carry the compressed bytes themselves, not just field values -- there is
 * nothing to retry later otherwise. OutboxSync's 'photo' handler performs
 * the same upload-then-insert sequence this does when it eventually
 * replays the mutation.
 *
 * Compression (compressPhoto, FR2) always runs first and always succeeds
 * offline -- it is pure client-side Canvas work with no network involved.
 * Only the Storage upload and the row insert can fail for connectivity
 * reasons, so only those are wrapped for the offline fallback.
 */
export function PhotoForm({
  organizationId,
  projectId,
  zones,
  workPackages,
}: {
  organizationId: string;
  projectId: string;
  zones: Zone[];
  workPackages: WorkPackage[];
}) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const file = formData.get('photo');
    if (!(file instanceof File) || file.size === 0) {
      return { status: 'error' as const, message: 'Pilih foto terlebih dahulu.' };
    }

    const zoneId = String(formData.get('zoneId'));
    const workPackageId = String(formData.get('workPackageId') ?? '').trim() || undefined;
    const caption = String(formData.get('caption') ?? '').trim() || undefined;
    const photoId = crypto.randomUUID();
    const date = today();

    const { main, thumbnail } = await compressPhoto(file);
    const storagePath = photoStoragePath({ organizationId, projectId, zoneId, date, photoId });
    const thumbnailPath = photoThumbnailStoragePath({ organizationId, projectId, zoneId, date, photoId });

    try {
      // Get presigned URL for main image and upload directly to R2
      const mainUrlResult = await getUploadPresignedUrlAction({ path: storagePath, contentType: 'image/webp' });
      if (!mainUrlResult.ok) throw new Error(mainUrlResult.error.message);
      
      const mainUploadRes = await fetch((mainUrlResult.data as { url: string }).url, {
        method: 'PUT',
        body: main,
        headers: { 'Content-Type': 'image/webp' },
      });
      if (!mainUploadRes.ok) throw new Error('Gagal mengunggah foto utama ke Cloudflare R2');

      // Get presigned URL for thumbnail and upload directly to R2
      const thumbUrlResult = await getUploadPresignedUrlAction({ path: thumbnailPath, contentType: 'image/webp' });
      if (!thumbUrlResult.ok) throw new Error(thumbUrlResult.error.message);
      
      const thumbUploadRes = await fetch((thumbUrlResult.data as { url: string }).url, {
        method: 'PUT',
        body: thumbnail,
        headers: { 'Content-Type': 'image/webp' },
      });
      if (!thumbUploadRes.ok) throw new Error('Gagal mengunggah thumbnail ke Cloudflare R2');

      const result = await createPhotoAction({
        id: photoId,
        projectId,
        zoneId,
        workPackageId,
        storagePath,
        thumbnailPath,
        fileSizeBytes: main.size,
        caption,
      });
      if (!result.ok) return { status: 'error' as const, message: result.error.message };
      return { status: 'ok' as const, message: 'Foto tersimpan.' };
    } catch {
      await enqueueMutation(indexedDbOutboxStore, {
        entityType: 'photo',
        entityId: photoId,
        operation: 'create',
        fields: {
          projectId,
          zoneId,
          workPackageId,
          caption,
          storagePath,
          thumbnailPath,
          mainBlob: main,
          thumbnailBlob: thumbnail,
        },
      });
      return { status: 'offline' as const, message: 'Tersimpan offline. Foto akan diunggah otomatis saat online.' };
    }
  }, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="photo">Foto</Label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            capture="environment"
            required
            className="mt-1 w-full text-sm text-[color:var(--color-ink-secondary)]"
          />
        </div>

        <div>
          <Label htmlFor="zoneId">Zona</Label>
          <Select id="zoneId" name="zoneId" required>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </div>

        {workPackages.length > 0 && (
          <div>
            <Label htmlFor="workPackageId">Paket kerja (opsional)</Label>
            <Select id="workPackageId" name="workPackageId" defaultValue="">
              <option value="">— Tidak terkait —</option>
              {workPackages.map((wp) => (
                <option key={wp.id} value={wp.id}>
                  {wp.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="caption">Keterangan</Label>
          <Input id="caption" name="caption" placeholder="Keterangan foto (opsional)" />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Menyimpan...' : 'Simpan Foto'}
        </Button>

        {state.status === 'error' && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.message}
          </p>
        )}
        {state.status === 'offline' && <p className="text-sm text-[color:var(--color-warning)]">{state.message}</p>}
        {state.status === 'ok' && <p className="text-sm text-[color:var(--color-success)]">{state.message}</p>}
      </form>
    </Card>
  );
}
