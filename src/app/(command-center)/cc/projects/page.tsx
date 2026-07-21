import Link from 'next/link';
import { listProjectsAction } from '@/modules/projects';

export const metadata = { title: 'Proyek — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export default async function ProjectsPage() {
  const result = await listProjectsAction(undefined);
  const projects = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Proyek</h1>
        <Link
          href="/cc/projects/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah proyek
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && projects.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada proyek. Tambahkan proyek pertama Anda.</p>
      )}

      {projects.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Mulai</th>
                <th className="px-4 py-2 font-medium">Target selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/cc/projects/${project.id}`} className="hover:underline">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{STATUS_LABEL_ID[project.status] ?? project.status}</td>
                  <td className="px-4 py-2 text-slate-600">{project.start_date ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{project.target_end_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
