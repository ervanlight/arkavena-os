import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import { getProjectAction, listWorkPackagesForProjectAction } from '@/modules/projects';
import { listHoldPointStatusForWorkPackageAction, type HoldPointTemplate, type Inspection } from '@/modules/quality-gate';
import { Card, StatusBadge, EmptyState } from '@/core/ui';
import { SetWorkTypeForm } from './set-work-type-form';
import { CreateInspectionForm } from './create-inspection-form';
import { RecordInspectionResultForm } from './record-inspection-result-form';
import { OverrideInspectionForm } from './override-inspection-form';

export const metadata = { title: 'Quality Gate proyek — Arkavena OS' };

const INSPECTION_STATUS_LABEL_ID: Record<string, string> = {
  pending: 'Menunggu',
  passed: 'Lulus',
  failed: 'Tidak lulus',
};

const INSPECTION_STATUS_TONE: Record<string, 'neutral' | 'success' | 'danger'> = {
  pending: 'neutral',
  passed: 'success',
  failed: 'danger',
};

export default async function ProjectQualityGatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const [projectResult, workPackagesResult, user] = await Promise.all([
    getProjectAction(projectId),
    listWorkPackagesForProjectAction(projectId),
    getCurrentUser(),
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
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];
  const isTechnicalDirector = roleCan(user?.orgRole ?? null, 'inspection', 'override');

  const workPackagesWithWorkType = workPackages.filter((wp) => wp.work_type !== null);
  const holdPointStatusEntries = await Promise.all(
    workPackagesWithWorkType.map(async (wp) => {
      const result = await listHoldPointStatusForWorkPackageAction(wp.id);
      return [wp.id, result.ok ? result.data : []] as const;
    }),
  );
  const holdPointStatusByWorkPackageId = new Map<
    string,
    { template: HoldPointTemplate; inspection: Inspection | null }[]
  >(holdPointStatusEntries);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[color:var(--color-ink-secondary)]">
        Paket kerja terkunci di jenis pekerjaannya sampai semua hold point wajib lulus atau di-override Technical
        Director -- terpisah dari Cash Gate, keduanya harus hijau.
      </p>

      {workPackages.length === 0 && <EmptyState title="Belum ada paket kerja pada proyek ini" />}

      <div className="space-y-4">
        {workPackages.map((wp) => {
          const holdPoints = holdPointStatusByWorkPackageId.get(wp.id) ?? [];
          return (
            <Card key={wp.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">{wp.name}</h2>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                    {wp.work_type !== null ? `Jenis pekerjaan: ${wp.work_type}` : 'Belum ada jenis pekerjaan'}
                  </p>
                </div>
                {wp.work_type === null && <SetWorkTypeForm workPackageId={wp.id} />}
              </div>

              {wp.work_type !== null && (
                <div className="mt-4 space-y-3">
                  {holdPoints.length === 0 && (
                    <p className="text-sm text-[color:var(--color-ink-tertiary)]">
                      Belum ada hold point untuk jenis pekerjaan &quot;{wp.work_type}&quot;.
                    </p>
                  )}
                  {holdPoints.map(({ template, inspection }) => (
                    <div key={template.id} className="rounded-[var(--radius-control)] border border-[color:var(--color-hairline)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[color:var(--color-ink)]">{template.name}</p>
                          {template.description !== null && (
                            <p className="text-xs text-[color:var(--color-ink-tertiary)]">{template.description}</p>
                          )}
                        </div>
                        {inspection !== null && (
                          <StatusBadge tone={INSPECTION_STATUS_TONE[inspection.status] ?? 'neutral'}>
                            {inspection.overridden_by !== null
                              ? 'Di-override TD'
                              : (INSPECTION_STATUS_LABEL_ID[inspection.status] ?? inspection.status)}
                          </StatusBadge>
                        )}
                      </div>

                      <div className="mt-2">
                        {inspection === null &&
                          (wp.zone_id !== null ? (
                            <CreateInspectionForm
                              projectId={project.id}
                              workPackageId={wp.id}
                              zoneId={wp.zone_id}
                              holdPointTemplateId={template.id}
                            />
                          ) : (
                            <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                              Tetapkan zona pada paket kerja ini dahulu sebelum memulai pemeriksaan.
                            </p>
                          ))}

                        {inspection !== null && inspection.overridden_by === null && inspection.status !== 'passed' && (
                          <RecordInspectionResultForm inspectionId={inspection.id} />
                        )}

                        {inspection !== null &&
                          inspection.overridden_by === null &&
                          inspection.status === 'failed' &&
                          isTechnicalDirector && <OverrideInspectionForm inspectionId={inspection.id} />}

                        {inspection?.override_reason != null && (
                          <p className="mt-1 text-xs text-[color:var(--color-ink-tertiary)]">
                            Alasan override: {inspection.override_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
