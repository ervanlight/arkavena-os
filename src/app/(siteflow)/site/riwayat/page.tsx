import { redirect } from 'next/navigation';
import {
  listDailyLogsForProjectAction,
  listIssuesForProjectAction,
  listMaterialRequestsForProjectAction,
  listProjectPhotosWithUrlsAction,
} from '@/modules/daily-report-inbox';
import { Card, EmptyState, StatusBadge } from '@/core/ui';

export const metadata = { title: 'Riwayat Laporan — SiteFlow' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SEVERITY_LABEL: Record<string, string> = { low: 'Ringan', medium: 'Sedang', high: 'Berat' };
const SEVERITY_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = { low: 'neutral', medium: 'warning', high: 'danger' };
const MATERIAL_STATUS_LABEL: Record<string, string> = {
  requested: 'Menunggu',
  fulfilled: 'Terpenuhi',
  cancelled: 'Dibatalkan',
};
const MATERIAL_STATUS_TONE: Record<string, 'neutral' | 'info' | 'success'> = {
  requested: 'info',
  fulfilled: 'success',
  cancelled: 'neutral',
};
const ISSUE_STATUS_LABEL: Record<string, string> = { open: 'Terbuka', resolved: 'Selesai' };
const ISSUE_STATUS_TONE: Record<string, 'warning' | 'success'> = { open: 'warning', resolved: 'success' };

export default async function RiwayatPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  const [dailyLogsResult, photosResult, materialRequestsResult, issuesResult] = await Promise.all([
    listDailyLogsForProjectAction(projectId),
    listProjectPhotosWithUrlsAction(projectId),
    listMaterialRequestsForProjectAction(projectId),
    listIssuesForProjectAction(projectId),
  ]);

  const dailyLogs = dailyLogsResult.ok ? dailyLogsResult.data : [];
  const photos = photosResult.ok ? photosResult.data : [];
  const materialRequests = materialRequestsResult.ok ? materialRequestsResult.data : [];
  const issues = issuesResult.ok ? issuesResult.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Riwayat Laporan</h1>

      <section className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
          Laporan Harian
        </h2>
        {dailyLogs.length === 0 ? (
          <EmptyState title="Belum ada laporan" />
        ) : (
          <div className="space-y-2">
            {dailyLogs.map((log) => (
              <Card key={log.id}>
                <p className="text-[14px] font-medium text-[color:var(--color-ink)]">{formatDate(log.log_date)}</p>
                <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                  {log.weather ?? '—'} · {log.manpower_count ?? '—'} pekerja
                </p>
                {log.notes !== null && log.notes !== '' && (
                  <p className="mt-1.5 text-xs text-[color:var(--color-ink-secondary)]">{log.notes}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Foto</h2>
        {photos.length === 0 ? (
          <EmptyState title="Belum ada foto" />
        ) : (
          <div className="space-y-3">
            {Object.entries(
              photos.reduce((acc, photo) => {
                const dateStr = new Date(photo.created_at).toLocaleDateString('sv-SE');
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push(photo);
                return acc;
              }, {} as Record<string, typeof photos>)
            )
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort newest first
            .map(([date, datePhotos]) => (
              <details key={date} className="group rounded-[var(--radius-card)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
                <summary className="flex cursor-pointer items-center justify-between p-3 focus:outline-none">
                  <div className="flex items-center gap-2 text-[color:var(--color-ink)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink-secondary)]">
                      📁
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                      <p className="text-xs text-[color:var(--color-ink-tertiary)]">{datePhotos.length} foto</p>
                    </div>
                  </div>
                  <span className="text-[color:var(--color-ink-tertiary)] transition-transform duration-200 group-open:rotate-90">
                    ▶
                  </span>
                </summary>
                
                <div className="border-t border-[color:var(--color-border)] p-3">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {datePhotos.map((photo) => (
                      <figure
                        key={photo.id}
                        className="overflow-hidden rounded-md bg-[color:var(--color-surface-secondary)]"
                      >
                        {photo.thumbnailUrl !== null ? (
                          <img src={photo.thumbnailUrl} alt={photo.caption ?? 'Foto proyek'} className="aspect-square w-full object-cover" />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center text-[color:var(--color-ink-tertiary)]">
                            —
                          </div>
                        )}
                        <figcaption className="p-1.5">
                          <p className="truncate text-[11px] font-medium text-[color:var(--color-ink)]">{photo.caption ?? '—'}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
          Permintaan Material
        </h2>
        {materialRequests.length === 0 ? (
          <EmptyState title="Belum ada permintaan" />
        ) : (
          <div className="space-y-2">
            {materialRequests.map((request) => (
              <Card key={request.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-[color:var(--color-ink)]">
                    {request.item_description} — {request.quantity} {request.unit}
                  </p>
                  <StatusBadge tone={MATERIAL_STATUS_TONE[request.status] ?? 'neutral'}>
                    {MATERIAL_STATUS_LABEL[request.status] ?? request.status}
                  </StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">{formatDate(request.created_at)}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Masalah</h2>
        {issues.length === 0 ? (
          <EmptyState title="Belum ada masalah dilaporkan" />
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <Card key={issue.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-[color:var(--color-ink)]">{issue.title}</p>
                  <StatusBadge tone={SEVERITY_TONE[issue.severity] ?? 'neutral'}>
                    {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                  </StatusBadge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--color-ink-tertiary)]">
                  <span>{formatDate(issue.created_at)}</span>
                  <StatusBadge tone={ISSUE_STATUS_TONE[issue.status] ?? 'neutral'}>
                    {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                  </StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
