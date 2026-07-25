import Link from 'next/link';
import { listProjectsAction } from '@/modules/projects';
import { PageHeader, Card, EmptyState } from '@/core/ui';

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
      <PageHeader
        title="Proyek"
        actions={
          <Link
            href="/cc/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah proyek
          </Link>
        }
      />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && projects.length === 0 && <EmptyState title="Belum ada proyek. Tambahkan proyek pertama Anda." />}

      {projects.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/cc/projects/${project.id}`}
                    className="truncate text-[15px] font-medium text-[color:var(--color-ink)] hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Mulai: {project.start_date ?? '—'} · Target selesai: {project.target_end_date ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-[color:var(--color-ink-secondary)]">
                  {STATUS_LABEL_ID[project.status] ?? project.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
