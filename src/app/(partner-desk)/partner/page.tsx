import type { Route } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { listMyPartnerProjectsAction } from '@/modules/projects';
import { Card, PageHeader, EmptyState } from '@/core/ui';

export const metadata = { title: 'Partner Desk — Arkavena OS' };

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
      <PageHeader title="Proyek Anda" />
      {projects.length === 0 && <EmptyState title="Belum ada proyek" description="Belum ada proyek yang bisa Anda akses." />}
      <div className="space-y-2.5">
        {projects.map((project) => (
          <Link key={project.id} href={`/partner/${project.id}` as Route}>
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
