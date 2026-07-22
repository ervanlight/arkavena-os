import { redirect } from 'next/navigation';
import {
  listDailyLogsForProjectAction,
  listIssuesForProjectAction,
  listMaterialRequestsForProjectAction,
  listPhotosForProjectAction,
} from '@/modules/field-reporting';

export const metadata = { title: 'Riwayat Laporan — SiteFlow' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SEVERITY_LABEL: Record<string, string> = { low: 'Ringan', medium: 'Sedang', high: 'Berat' };
const MATERIAL_STATUS_LABEL: Record<string, string> = {
  requested: 'Menunggu',
  fulfilled: 'Terpenuhi',
  cancelled: 'Dibatalkan',
};
const ISSUE_STATUS_LABEL: Record<string, string> = { open: 'Terbuka', resolved: 'Selesai' };

export default async function RiwayatPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  const [dailyLogsResult, photosResult, materialRequestsResult, issuesResult] = await Promise.all([
    listDailyLogsForProjectAction(projectId),
    listPhotosForProjectAction(projectId),
    listMaterialRequestsForProjectAction(projectId),
    listIssuesForProjectAction(projectId),
  ]);

  const dailyLogs = dailyLogsResult.ok ? dailyLogsResult.data : [];
  const photos = photosResult.ok ? photosResult.data : [];
  const materialRequests = materialRequestsResult.ok ? materialRequestsResult.data : [];
  const issues = issuesResult.ok ? issuesResult.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Riwayat Laporan</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Laporan Harian</h2>
        {dailyLogs.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada laporan.</p>
        ) : (
          <ul className="space-y-2">
            {dailyLogs.map((log) => (
              <li key={log.id} className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-sm font-medium text-slate-900">{formatDate(log.log_date)}</p>
                <p className="text-xs text-slate-500">
                  {log.weather ?? '—'} · {log.manpower_count ?? '—'} pekerja
                </p>
                {log.notes !== null && <p className="mt-1 text-xs text-slate-600">{log.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Foto</h2>
        {photos.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada foto.</p>
        ) : (
          <ul className="space-y-2">
            {photos.map((photo) => (
              <li key={photo.id} className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-sm text-slate-900">{photo.caption ?? 'Tanpa keterangan'}</p>
                <p className="text-xs text-slate-500">{formatDate(photo.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Permintaan Material</h2>
        {materialRequests.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada permintaan.</p>
        ) : (
          <ul className="space-y-2">
            {materialRequests.map((request) => (
              <li key={request.id} className="rounded-lg bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">
                    {request.item_description} — {request.quantity} {request.unit}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {MATERIAL_STATUS_LABEL[request.status] ?? request.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{formatDate(request.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Masalah</h2>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada masalah dilaporkan.</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li key={issue.id} className="rounded-lg bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{issue.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {formatDate(issue.created_at)} · {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
