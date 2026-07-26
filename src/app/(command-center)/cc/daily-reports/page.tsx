import { Check } from 'lucide-react';
import { listPendingDailyLogsAction } from '@/modules/daily-report-inbox';
import { DailyReportInboxItem } from './daily-report-inbox-item';

export const metadata = { title: 'Daily Report Inbox — Arkavena OS' };

export default async function DailyReportInboxPage() {
  const result = await listPendingDailyLogsAction(undefined);
  const pendingLogs = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Daily Report Inbox</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Tinjau laporan harian dari subkontraktor sebelum dikurasi &amp; dipublikasikan ke Client Feed.
        </p>
      </div>

      {pendingLogs.length === 0 ? (
        <div className="rounded-[12px] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-surface-secondary)]">
            <Check size={24} className="text-[color:var(--color-ink-tertiary)]" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-[color:var(--color-ink)]">Inbox Kosong</h3>
          <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">
            Tidak ada laporan harian yang menunggu review saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingLogs.map((log) => (
            <DailyReportInboxItem key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
