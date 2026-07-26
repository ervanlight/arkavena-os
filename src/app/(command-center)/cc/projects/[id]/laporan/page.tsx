import { CloudSun, Users } from 'lucide-react';
import { listDailyLogsForProjectAction } from '@/modules/daily-report-inbox';
import { Card, EmptyState } from '@/core/ui';

export const metadata = { title: 'Laporan harian — Arkavena OS' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** The daily-log archive: every field report for this project, newest first. */
export default async function ProjectLaporanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await listDailyLogsForProjectAction(id);
  const logs = result.ok ? result.data : [];

  if (logs.length === 0) {
    return <EmptyState title="Belum ada laporan" description="Laporan harian dari tim lapangan akan muncul di sini." />;
  }

  return (
    <div className="space-y-2.5">
      {logs.map((log) => (
        <Card key={log.id}>
          <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">{formatDate(log.log_date)}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[color:var(--color-ink-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <CloudSun size={15} className="text-[color:var(--color-ink-tertiary)]" />
              {log.weather ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} className="text-[color:var(--color-ink-tertiary)]" />
              {log.manpower_count ?? '—'} pekerja
            </span>
          </div>
          {log.notes !== null && log.notes !== '' && (
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-ink-secondary)]">{log.notes}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
