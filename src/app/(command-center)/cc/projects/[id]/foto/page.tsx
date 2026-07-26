import { listProjectPhotosWithUrlsAction } from '@/modules/daily-report-inbox';
import { EmptyState } from '@/core/ui';

export const metadata = { title: 'Foto proyek — Arkavena OS' };

const STAGE_LABEL: Record<string, string> = {
  before: 'Sebelum',
  during: 'Proses',
  after: 'Sesudah',
};

/** The photo gallery staff never had: every field upload for this project, browsable. */
export default async function ProjectPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await listProjectPhotosWithUrlsAction(id);
  const photos = result.ok ? result.data : [];

  if (photos.length === 0) {
    return <EmptyState title="Belum ada foto" description="Foto yang diunggah tim lapangan lewat SiteFlow akan muncul di sini." />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo) => (
        <figure
          key={photo.id}
          className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]"
        >
          {photo.thumbnailUrl !== null ? (
            /* A time-limited signed URL, not a local/optimizable asset -- next/image would only add a remote-pattern config for a URL that expires in an hour (same call the client portal's photo grid makes). */
            <img src={photo.thumbnailUrl} alt={photo.caption ?? 'Foto proyek'} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink-tertiary)]">
              —
            </div>
          )}
          <figcaption className="p-2.5">
            <p className="truncate text-xs font-medium text-[color:var(--color-ink)]">{photo.caption ?? '—'}</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-tertiary)]">
              {new Date(photo.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              {photo.photo_stage !== null && ` · ${STAGE_LABEL[photo.photo_stage] ?? photo.photo_stage}`}
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
