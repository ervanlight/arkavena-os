import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { listWorkPackagesForProjectAction, listZonesForProjectAction } from '@/modules/projects';
import { PhotoForm } from './photo-form';

export const metadata = { title: 'Ambil Foto — SiteFlow' };

export default async function PhotoPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  const [user, zonesResult, workPackagesResult] = await Promise.all([
    getCurrentUser(),
    listZonesForProjectAction(projectId),
    listWorkPackagesForProjectAction(projectId),
  ]);

  const zones = zonesResult.ok ? zonesResult.data : [];
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];

  if (user === null) redirect('/login');

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Ambil Foto</h1>
      {zones.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm">
          Belum ada zona di proyek ini. Hubungi kantor untuk menambahkan.
        </p>
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
