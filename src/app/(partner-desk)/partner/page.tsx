import type { Route } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { listMyPartnerProjectsAction } from '@/modules/projects';

export const metadata = { title: 'Partner Desk — BuildTrust OS' };

/**
 * Landing page for a supplier with more than one project -- same "skip
 * straight past this if there's exactly one" reasoning as
 * (client-portal)/portal/page.tsx (ADR 0016).
 */
export default async function PartnerDeskHomePage() {
  const result = await listMyPartnerProjectsAction(undefined);
  const projects = result.ok ? result.data : [];

  if (projects.length === 1) {
    redirect(`/partner/${projects[0]!.id}` as Route);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Proyek Anda</h1>
      {projects.length === 0 && <p className="text-sm text-slate-500">Belum ada proyek yang bisa Anda akses.</p>}
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/partner/${project.id}` as Route}
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
