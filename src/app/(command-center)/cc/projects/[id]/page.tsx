import { notFound } from 'next/navigation';
import { getProjectAction, listZonesForProjectAction, ZoneMap } from '@/modules/projects';
import { AddZoneForm } from './add-zone-form';

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

  const [projectResult, zonesResult] = await Promise.all([getProjectAction(id), listZonesForProjectAction(id)]);

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

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
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
    </div>
  );
}
