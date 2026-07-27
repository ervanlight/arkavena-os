import { notFound } from 'next/navigation';
import {
  getProjectAction,
  listProjectMembersAction,
  listWorkPackagesForProjectAction,
  listZonesForProjectAction,
  ZoneMap,
} from '@/modules/projects';
import { listStaffUsersAction } from '@/core/auth/invite-staff-user';
import { Card, StatusBadge, EmptyState, SCurveChart } from '@/core/ui';
import { AddZoneForm } from './add-zone-form';
import { StartWorkPackageForm } from './start-work-package-form';
import { DelayDetectionWidget } from './delay-detection-widget';
import { ProjectMembersPanel } from './project-members-panel';

const WORK_PACKAGE_STATUS_LABEL_ID: Record<string, string> = {
  not_started: 'Belum mulai',
  in_progress: 'Berjalan',
  completed: 'Selesai',
};

const WORK_PACKAGE_STATUS_TONE: Record<string, 'neutral' | 'info' | 'success'> = {
  not_started: 'neutral',
  in_progress: 'info',
  completed: 'success',
};

export const metadata = { title: 'Detail proyek — Arkavena OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  planning: 'neutral',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [projectResult, zonesResult, workPackagesResult, membersResult, usersResult] = await Promise.all([
    getProjectAction(id),
    listZonesForProjectAction(id),
    listWorkPackagesForProjectAction(id),
    listProjectMembersAction(id),
    listStaffUsersAction(undefined),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {projectResult.error.message}
      </p>
    );
  }

  const project = projectResult.data;
  const zones = zonesResult.ok ? zonesResult.data : [];
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];
  const members = membersResult.ok ? membersResult.data : [];
  const nameByUserId = Object.fromEntries(
    (usersResult.ok ? usersResult.data : []).map((u) => [u.id, u.full_name] as const),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Status</p>
          <div className="mt-2">
            <StatusBadge tone={STATUS_TONE[project.status] ?? 'neutral'}>
              {STATUS_LABEL_ID[project.status] ?? project.status}
            </StatusBadge>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Mulai</p>
          <p className="mt-1 text-[15px] font-semibold text-[color:var(--color-ink)]">{project.start_date ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Target selesai</p>
          <p className="mt-1 text-[15px] font-semibold text-[color:var(--color-ink)]">{project.target_end_date ?? '—'}</p>
        </Card>
      </div>

      <DelayDetectionWidget projectId={project.id} />

      <SCurveChart
        startDate={project.start_date}
        targetCompletionDate={project.target_end_date}
      />

      <Card className="space-y-3">
        <div>
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Tim proyek</h2>
          <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
            Klien yang diundang di sini bisa membuka Portal Klien; mandor/koordinator bisa memakai SiteFlow.
          </p>
        </div>
        <ProjectMembersPanel
          projectId={project.id}
          members={members}
          nameByUserId={nameByUserId}
          allOrgUsers={usersResult.ok ? usersResult.data : []}
        />
      </Card>

      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Zona</h2>
        <ZoneMap zones={zones} />
        <Card className="border border-dashed border-[color:var(--color-hairline)] shadow-none">
          <AddZoneForm projectId={project.id} />
        </Card>
      </div>

      <Card>
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Paket kerja</h2>
        {workPackages.length === 0 && (
          <div className="mt-3">
            <EmptyState title="Belum ada paket kerja" />
          </div>
        )}
        {workPackages.length > 0 && (
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {workPackages.map((wp) => (
              <li key={wp.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{wp.name}</p>
                  {wp.change_order_id !== null && (
                    <p className="text-xs text-[color:var(--color-accent-hover)]">Dari variation</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge tone={WORK_PACKAGE_STATUS_TONE[wp.status] ?? 'neutral'}>
                    {WORK_PACKAGE_STATUS_LABEL_ID[wp.status] ?? wp.status}
                  </StatusBadge>
                  {wp.status === 'not_started' && <StartWorkPackageForm workPackageId={wp.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
