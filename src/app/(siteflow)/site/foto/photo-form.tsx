'use client';

import { useActionState } from 'react';
import { createBrowserSupabase } from '@/core/db/client.browser';
import { compressPhoto } from '@/core/storage/compress-image';
import { photoStoragePath, photoThumbnailStoragePath } from '@/core/storage/paths';
import { createPhotoAction } from '@/modules/field-reporting';
import { enqueueMutation } from '@/core/offline/outbox';
import { indexedDbOutboxStore } from '@/core/offline/indexeddb-store';

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
      const supabase = createBrowserSupabase();

      // upsert: true makes a retried upload (same photoId, same path) safe
      // -- without it, re-uploading after a dropped connection would fail
      // with "already exists" instead of just succeeding again.
      const mainUpload = await supabase.storage
        .from('photos')
        .upload(storagePath, main, { contentType: 'image/jpeg', upsert: true });
      if (mainUpload.error !== null) throw new Error(mainUpload.error.message);

      const thumbUpload = await supabase.storage
        .from('photos')
        .upload(thumbnailPath, thumbnail, { contentType: 'image/jpeg', upsert: true });
      if (thumbUpload.error !== null) throw new Error(thumbUpload.error.message);

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
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="photo" className="block text-sm font-medium text-slate-700">
          Foto
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="mt-1 w-full text-sm text-slate-700"
        />
      </div>

      <div>
        <label htmlFor="zoneId" className="block text-sm font-medium text-slate-700">
          Zona
        </label>
        <select
          id="zoneId"
          name="zoneId"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      {workPackages.length > 0 && (
        <div>
          <label htmlFor="workPackageId" className="block text-sm font-medium text-slate-700">
            Paket kerja (opsional)
          </label>
          <select
            id="workPackageId"
            name="workPackageId"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">— Tidak terkait —</option>
            {workPackages.map((wp) => (
              <option key={wp.id} value={wp.id}>
                {wp.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="caption" className="block text-sm font-medium text-slate-700">
          Keterangan
        </label>
        <input
          id="caption"
          name="caption"
          placeholder="Keterangan foto (opsional)"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-3 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan Foto'}
      </button>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === 'offline' && <p className="text-sm text-amber-600">{state.message}</p>}
      {state.status === 'ok' && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
