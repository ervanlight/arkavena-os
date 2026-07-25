import type { Route } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { listMyClientProjectsAction } from '@/modules/projects';
import { Card, PageHeader, EmptyState } from '@/core/ui';

export const metadata = { title: 'Portal Klien — Arkavena OS' };

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
      <PageHeader title="Proyek Anda" />
      {projects.length === 0 && <EmptyState title="Belum ada proyek" description="Belum ada proyek yang bisa Anda akses." />}
      <div className="space-y-2.5">
        {projects.map((project) => (
          <Link key={project.id} href={`/portal/${project.id}` as Route}>
            <Card interactive className="flex items-center justify-between">
              <span className="text-[15px] font-medium text-[color:var(--color-ink)]">{project.name}</span>
              <ChevronRight size={18} className="text-[color:var(--color-ink-tertiary)]" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
