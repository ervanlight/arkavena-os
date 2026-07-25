import { listProjectActivityAction } from '@/modules/projects';
import { ActivityFeed } from '../../../../_components/activity-feed';

export const metadata = { title: 'Aktivitas proyek — Arkavena OS' };

/**
 * The project's activity journal (audit_logs). The one place field uploads
 * (photos, daily logs, progress, issues) and business events (variation,
 * Cash Gate override, invoice, quality) show up together, chronologically --
 * what turns the Command Center from a form to file things into a tool to
 * see what is happening on a project.
 */
export default async function ProjectAktivitasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await listProjectActivityAction(id);
  const events = result.ok ? result.data : [];

  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  return <ActivityFeed events={events} />;
}
