import Link from 'next/link';
import { FolderOpen, ArrowLeft } from 'lucide-react';
import { listProjectPhotosWithUrlsAction } from '@/modules/daily-report-inbox';
import { EmptyState } from '@/core/ui';

export const metadata = { title: 'Foto proyek — Arkavena OS' };

const STAGE_LABEL: Record<string, string> = {
  before: 'Sebelum',
  during: 'Proses',
  after: 'Sesudah',
};

export default async function ProjectPhotosPage(props: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const selectedDate = searchParams.date;

  const result = await listProjectPhotosWithUrlsAction(id);
  const photos = result.ok ? result.data : [];

  if (photos.length === 0) {
    return <EmptyState title="Belum ada foto" description="Foto yang diunggah tim lapangan lewat SiteFlow akan muncul di sini." />;
  }

  // Helper to format ISO string to local date string (YYYY-MM-DD)
  const toDateString = (isoString: string) => {
    // using Sweden locale as a hack to get YYYY-MM-DD format reliably in Node
    return new Date(isoString).toLocaleDateString('sv-SE');
  };

  if (selectedDate) {
    // ------------------------------------------------------------------------
    // GRID VIEW (Photos for a specific date)
    // ------------------------------------------------------------------------
    const filteredPhotos = photos.filter((photo) => toDateString(photo.created_at) === selectedDate);
    const displayDate = new Date(selectedDate).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 border-b border-[color:var(--color-border)] pb-3">
          <Link
            href={`/cc/projects/${id}/foto`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink-secondary)] transition-colors hover:bg-[color:var(--color-surface-tertiary)] hover:text-[color:var(--color-ink)]"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">{displayDate}</h2>
            <p className="text-xs text-[color:var(--color-ink-tertiary)]">{filteredPhotos.length} foto</p>
          </div>
        </div>

        {filteredPhotos.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-secondary)]">Tidak ada foto pada tanggal ini.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredPhotos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]"
              >
                {photo.thumbnailUrl !== null ? (
                  <img src={photo.thumbnailUrl} alt={photo.caption ?? 'Foto proyek'} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink-tertiary)]">
                    —
                  </div>
                )}
                <figcaption className="p-2.5">
                  <p className="truncate text-xs font-medium text-[color:var(--color-ink)]">{photo.caption ?? '—'}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-tertiary)]">
                    {photo.photo_stage !== null ? (STAGE_LABEL[photo.photo_stage] ?? photo.photo_stage) : 'Tanpa Tahapan'}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // FOLDER VIEW (Grouped by date)
  // ------------------------------------------------------------------------
  const groupedPhotos = photos.reduce((acc, photo) => {
    const dateStr = toDateString(photo.created_at);
    if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, count: 0, latestUrl: null as string | null };
    }
    acc[dateStr].count += 1;
    // Keep the first one we see (latest by created_at since it's ordered desc)
    if (!acc[dateStr].latestUrl && photo.thumbnailUrl) {
      acc[dateStr].latestUrl = photo.thumbnailUrl;
    }
    return acc;
  }, {} as Record<string, { date: string; count: number; latestUrl: string | null }>);

  // Convert to array and sort descending by date
  const folders = Object.values(groupedPhotos).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {folders.map((folder) => {
        const displayDate = new Date(folder.date).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        return (
          <Link
            key={folder.date}
            href={`/cc/projects/${id}/foto?date=${folder.date}`}
            className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            <div className="relative aspect-[4/3] w-full bg-[color:var(--color-surface-secondary)]">
              {folder.latestUrl ? (
                <>
                  <img src={folder.latestUrl} alt={`Cover ${displayDate}`} className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[color:var(--color-ink-tertiary)]">
                  <FolderOpen size={32} />
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white">
                <FolderOpen size={18} className="drop-shadow-md" />
                <span className="text-xs font-medium drop-shadow-md">{folder.count} Item</span>
              </div>
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">{displayDate}</h3>
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">Ketuk untuk membuka</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
