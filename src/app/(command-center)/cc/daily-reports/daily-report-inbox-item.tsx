'use client';

import { useState } from 'react';
import { Inbox, Check, X, RotateCcw } from 'lucide-react';
import { Card } from '@/core/ui';
import { reviewDailyLogAction } from '@/modules/daily-report-inbox';
import { useRouter } from 'next/navigation';

export function DailyReportInboxItem({
  log,
}: {
  log: {
    id: string;
    log_date: string;
    notes: string | null;
    project_name: string;
  };
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReview(decision: 'publish' | 'reject') {
    setIsPending(true);
    setError(null);
    try {
      const res = await reviewDailyLogAction({ id: log.id, decision });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error.message);
      }
    } catch (e) {
      setError('An internal error occurred');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="border border-[color:var(--color-hairline)] p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[color:var(--color-hairline)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
            <Inbox size={20} />
          </div>
          <div>
            <p className="text-base font-semibold text-[color:var(--color-ink)]">
              Laporan Harian - {new Date(log.log_date).toLocaleDateString('id-ID')}
            </p>
            <p className="text-xs text-[color:var(--color-ink-tertiary)]">
              Proyek: {log.project_name}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-600">
          Menunggu Review PM
        </span>
      </div>

      <p className="text-sm text-[color:var(--color-ink-secondary)]">
        {log.notes || 'Tidak ada catatan tambahan.'}
      </p>

      {error && (
        <div className="text-sm text-red-600 font-medium">Error: {error}</div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={() => handleReview('reject')}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink-secondary)] hover:bg-gray-100 disabled:opacity-50"
        >
          <RotateCcw size={14} /> Minta Revisi
        </button>
        <button
          onClick={() => handleReview('reject')}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-50"
        >
          <X size={14} /> Tolak
        </button>
        <button
          onClick={() => handleReview('publish')}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
        >
          <Check size={14} /> {isPending ? 'Memproses...' : 'Disetujui & Terbitkan ke Klien'}
        </button>
      </div>
    </Card>
  );
}
