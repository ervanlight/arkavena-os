import type { Route } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProjectAction, listWorkPackagesForProjectAction, listZonesForProjectAction, ZoneMap } from '@/modules/projects';
import { AddZoneForm } from './add-zone-form';
import { StartWorkPackageForm } from './start-work-package-form';

const WORK_PACKAGE_STATUS_LABEL_ID: Record<string, string> = {
  not_started: 'Belum mulai',
  in_progress: 'Berjalan',
  completed: 'Selesai',
};

export const metadata = { title: 'Detail proyek — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [projectResult, zonesResult, workPackagesResult] = await Promise.all([
    getProjectAction(id),
    listZonesForProjectAction(id),
    listWorkPackagesForProjectAction(id),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-red-600">
        {projectResult.error.message}
      </p>
    );
  }

  const project = projectResult.data;
  const zones = zonesResult.ok ? zonesResult.data : [];
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
          <div className="flex gap-2">
            <Link
              href={`/cc/projects/${project.id}/estimates`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Estimasi
            </Link>
            <Link
              href={`/cc/projects/${project.id}/procurement`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Prokuremen
            </Link>
            <Link
              href={`/cc/projects/${project.id}/handover`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Handover
            </Link>
            <Link
              href={`/cc/projects/${project.id}/variations`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Variation
            </Link>
            <Link
              href={`/cc/projects/${project.id}/quality-gate`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Quality Gate
            </Link>
            <Link
              href={`/cc/projects/${project.id}/invoices` as Route}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Invoice
            </Link>
            <Link
              href={`/cc/projects/${project.id}/cash-gate`}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Cash Gate
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Status</dt>
          <dd className="text-slate-900">{STATUS_LABEL_ID[project.status] ?? project.status}</dd>
          <dt className="text-slate-500">Mulai</dt>
          <dd className="text-slate-900">{project.start_date ?? '—'}</dd>
          <dt className="text-slate-500">Target selesai</dt>
          <dd className="text-slate-900">{project.target_end_date ?? '—'}</dd>
        </dl>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Zona (ZoneMap)</h2>
        <ZoneMap zones={zones} />
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <AddZoneForm projectId={project.id} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Paket kerja</h2>
        {workPackages.length === 0 && <p className="text-sm text-slate-500">Belum ada paket kerja.</p>}
        {workPackages.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nama</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Asal</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workPackages.map((wp) => (
                  <tr key={wp.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{wp.name}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {WORK_PACKAGE_STATUS_LABEL_ID[wp.status] ?? wp.status}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {wp.change_order_id !== null ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          Dari variation
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {wp.status === 'not_started' && <StartWorkPackageForm workPackageId={wp.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
