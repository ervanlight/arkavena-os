import { listClientProgressPhotosAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';
import { EmptyState } from '@/core/ui';

export const metadata = { title: 'Foto Progres — BuildTrust OS' };

export default async function ClientPortalPhotosPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const result = await listClientProgressPhotosAction(projectId);
  const photos = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Foto Progres</h1>
        <PortalNav projectId={projectId} active="/foto" />
      </div>

      {photos.length === 0 ? (
        <EmptyState title="Belum ada foto progres" />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((photo) => (
            <figure
              key={photo.photo_id}
              className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              {/* A time-limited signed URL, not a local/optimizable asset -- next/image would just add an unnecessary remote-pattern config for this. */}
              {photo.thumbnailUrl !== null && (
                <img src={photo.thumbnailUrl} alt={photo.caption ?? ''} className="aspect-square w-full object-cover" />
              )}
              <figcaption className="p-2">
                <p className="truncate text-xs font-medium text-[color:var(--color-ink)]">{photo.caption ?? '—'}</p>
                <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-tertiary)]">
                  {new Date(photo.created_at).toLocaleDateString('id-ID')} · {photo.uploaded_by_name}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
