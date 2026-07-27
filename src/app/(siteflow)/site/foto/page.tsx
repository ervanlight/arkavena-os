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

  const projectsResult = await listMyFieldProjectsAction(undefined);
  const projects = projectsResult.ok ? projectsResult.data : [];

  let projectId = rawProjectId;
  if (!projectId) {
    const firstProject = projects[0];
    if (!firstProject) {
      return (
        <Card>
          <p className="text-sm text-[color:var(--color-ink-secondary)] font-medium">
            Anda belum terdaftar sebagai pengawas di proyek manapun. Hubungi admin kantor Arkavena.
          </p>
        </Card>
      );
    }
    projectId = firstProject.id;
  }

  const [zonesResult, workPackagesResult] = await Promise.all([
    listZonesForProjectAction(projectId),
    listWorkPackagesForProjectAction(projectId),
  ]);

  const zones = zonesResult.ok ? zonesResult.data : [];
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Ambil Foto Lapangan</h1>

        {/* Project Selector dropdown if Pengawas is assigned to multiple projects */}
        {projects.length > 1 && (
          <form method="GET" action="/site/foto" className="flex items-center gap-2">
            <label htmlFor="projectSelect" className="text-xs font-semibold text-[color:var(--color-ink-secondary)] shrink-0">
              Pilih Proyek:
            </label>
            <select
              id="projectSelect"
              name="projectId"
              defaultValue={projectId}
              onChange={(e) => e.target.form?.submit()}
              className="rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink)] shadow-sm focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </form>
        )}
      </div>

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
