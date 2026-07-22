import type { Route } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { listMyClientProjectsAction } from '@/modules/projects';

export const metadata = { title: 'Portal Klien — BuildTrust OS' };

/**
 * Landing page for a client with more than one project. Someone with
 * exactly one skips straight past this -- one project is the common case
 * (ADR 0016), and a picker nobody needs is just an extra click.
 */
export default async function ClientPortalHomePage() {
  const result = await listMyClientProjectsAction(undefined);
  const projects = result.ok ? result.data : [];

  if (projects.length === 1) {
    redirect(`/portal/${projects[0]!.id}` as Route);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Proyek Anda</h1>
      {projects.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada proyek yang bisa Anda akses.</p>
      )}
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/portal/${project.id}` as Route}
              className="block rounded-lg bg-white p-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
            >
              {project.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
