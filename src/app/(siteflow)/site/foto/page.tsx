import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { listWorkPackagesForProjectAction, listZonesForProjectAction, listMyFieldProjectsAction } from '@/modules/projects';
import { PhotoForm } from './photo-form';
import { Card } from '@/core/ui';

export const metadata = { title: 'Ambil Foto — SiteFlow' };

export default async function PhotoPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const user = await getCurrentUser();
  if (user === null) redirect('/login');

  const { projectId: rawProjectId } = await searchParams;
  let projectId = rawProjectId;

  if (!projectId) {
    const projectsResult = await listMyFieldProjectsAction(undefined);
    const projects = projectsResult.ok ? projectsResult.data : [];
    if (projects.length === 0) {
      return (
        <Card>
          <p className="text-sm text-[color:var(--color-ink-secondary)] font-medium">
            Anda belum terdaftar sebagai pengawas di proyek manapun. Hubungi admin kantor Arkavena.
          </p>
        </Card>
      );
    }
    projectId = projects[0].id;
  }

  const [zonesResult, workPackagesResult] = await Promise.all([
    listZonesForProjectAction(projectId),
    listWorkPackagesForProjectAction(projectId),
  ]);

  const zones = zonesResult.ok ? zonesResult.data : [];
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];

  if (user === null) redirect('/login');

  return (
    <div className="space-y-4">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Ambil Foto</h1>
      {zones.length === 0 ? (
        <Card>
          <p className="text-sm text-[color:var(--color-ink-secondary)]">
            Belum ada zona di proyek ini. Hubungi kantor untuk menambahkan.
          </p>
        </Card>
      ) : (
        <PhotoForm
          organizationId={user.organizationId}
          projectId={projectId}
          zones={zones}
          workPackages={workPackages}
        />
      )}
    </div>
  );
}
