import { redirect } from 'next/navigation';
import { createDailyLogAction, listDailyLogsForProjectAction } from '@/modules/field-reporting';
import { listWorkPackagesForProjectAction } from '@/modules/projects';
import { ProgressForm } from './progress-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Update Progress — SiteFlow' };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Finds today's daily log for this project, creating one silently if it does not exist yet -- a progress entry always needs a daily_log_id, and the DoD's "under 3 minutes" goal means the mandor should not have to go create one first. */
async function ensureTodaysDailyLogId(projectId: string): Promise<string> {
  const listResult = await listDailyLogsForProjectAction(projectId);
  const logs = listResult.ok ? listResult.data : [];
  const existing = logs.find((log) => log.log_date === today());
  if (existing !== undefined) return existing.id;

  const created = await createDailyLogAction({ id: crypto.randomUUID(), projectId, logDate: today() });
  if (!created.ok) throw new Error(created.error.message);
  return created.data.id;
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  const [dailyLogId, workPackagesResult] = await Promise.all([
    ensureTodaysDailyLogId(projectId),
    listWorkPackagesForProjectAction(projectId),
  ]);
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];

  return (
    <div className="space-y-4">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Update Progress</h1>
      {workPackages.length === 0 ? (
        <Card>
          <p className="text-sm text-[color:var(--color-ink-secondary)]">
            Belum ada paket kerja di proyek ini. Hubungi kantor untuk menambahkan.
          </p>
        </Card>
      ) : (
        <ProgressForm projectId={projectId} dailyLogId={dailyLogId} workPackages={workPackages} />
      )}
    </div>
  );
}
