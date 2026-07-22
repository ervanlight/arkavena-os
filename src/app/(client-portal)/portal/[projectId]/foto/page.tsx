import { listClientProgressPhotosAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';

export const metadata = { title: 'Foto Progres — BuildTrust OS' };

export default async function ClientPortalPhotosPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const result = await listClientProgressPhotosAction(projectId);
  const photos = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Foto Progres</h1>
        <PortalNav projectId={projectId} active="/foto" />
      </div>

      {photos.length === 0 && <p className="text-sm text-slate-500">Belum ada foto progres.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <figure key={photo.photo_id} className="overflow-hidden rounded-lg bg-white shadow-sm">
            {/* A time-limited signed URL, not a local/optimizable asset -- next/image would just add an unnecessary remote-pattern config for this. */}
            {photo.thumbnailUrl !== null && (
              <img src={photo.thumbnailUrl} alt={photo.caption ?? ''} className="h-32 w-full object-cover" />
            )}
            <figcaption className="p-2 text-xs text-slate-600">
              {photo.caption ?? '—'}
              <span className="mt-1 block text-slate-400">
                {new Date(photo.created_at).toLocaleDateString('id-ID')} · {photo.uploaded_by_name}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
