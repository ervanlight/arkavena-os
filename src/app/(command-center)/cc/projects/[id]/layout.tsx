import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getProjectAction } from '@/modules/projects';
import { ProjectWorkspaceNav } from './project-workspace-nav';

/**
 * Wraps every project sub-page in one workspace shell: a breadcrumb back to
 * the project list and the tab bar. Fetching the name here means each child
 * page renders only its own content, not its own project header. Resilient
 * to a missing/inaccessible project -- the child page owns its 404; this just
 * falls back to a neutral breadcrumb so the shell still frames the page.
 */
export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectResult = await getProjectAction(id);
  const projectName = projectResult.ok ? projectResult.data.name : 'Proyek';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/cc/projects"
          className="inline-flex items-center gap-1 text-[13px] text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-secondary)]"
        >
          <ChevronLeft size={14} />
          Proyek
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight text-[color:var(--color-ink)]">{projectName}</h1>
        <ProjectWorkspaceNav projectId={id} />
      </div>
      {children}
    </div>
  );
}
