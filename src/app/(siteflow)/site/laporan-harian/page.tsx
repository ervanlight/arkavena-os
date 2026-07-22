import { redirect } from 'next/navigation';
import { DailyLogForm } from './daily-log-form';

export const metadata = { title: 'Laporan Harian — SiteFlow' };

export default async function DailyLogPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Laporan Harian</h1>
      <DailyLogForm projectId={projectId} />
    </div>
  );
}
