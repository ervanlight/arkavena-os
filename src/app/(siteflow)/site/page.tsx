import Link from 'next/link';
import type { Route } from 'next';
import { ClipboardList, TrendingUp, Camera, Boxes, TriangleAlert, History, type LucideIcon } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { listMyFieldProjectsAction, listProjectActivityAction } from '@/modules/projects';
import { Card } from '@/core/ui';

export const metadata = { title: 'SiteFlow — Arkavena OS' };

const MENU: { href: string; label: string; hint: string; icon: LucideIcon; tint: string }[] = [
  { href: 'laporan-harian', label: 'Laporan Harian', hint: 'Cuaca, jumlah pekerja, catatan hari ini', icon: ClipboardList, tint: '#0a84ff' },
  { href: 'progress', label: 'Update Progress', hint: 'Persentase pekerjaan per paket kerja', icon: TrendingUp, tint: '#34c759' },
  { href: 'foto', label: 'Ambil Foto', hint: 'Foto lokasi, terikat proyek + zona', icon: Camera, tint: '#af52de' },
  { href: 'material', label: 'Minta Material', hint: 'Ajukan kebutuhan material ke kantor', icon: Boxes, tint: '#ff9f0a' },
  { href: 'masalah', label: 'Lapor Masalah', hint: 'Catat kendala di lapangan', icon: TriangleAlert, tint: '#ff453a' },
  { href: 'riwayat', label: 'Riwayat Laporan', hint: 'Lihat laporan yang sudah diinput', icon: History, tint: '#6e6e73' },
];

const TODAY_ENTITY_LABEL: Record<string, string> = {
  daily_logs: 'laporan harian',
  photos: 'foto',
  progress_entries: 'update progres',
  material_requests: 'permintaan material',
  issues: 'masalah dilaporkan',
};

/** Small "what's already logged today" summary -- so a mandor sees at a glance whether today's report is still missing before adding more. */
function TodayActivitySummary({ counts }: { counts: Map<string, number> }) {
  if (counts.size === 0) {
    return (
      <Card className="border border-dashed border-[color:var(--color-hairline)] shadow-none">
        <p className="text-sm text-[color:var(--color-ink-tertiary)]">Belum ada aktivitas dicatat hari ini.</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Hari ini</p>
      <p className="mt-1.5 text-[14px] text-[color:var(--color-ink)]">
        {[...counts.entries()]
          .map(([table, count]) => `${count} ${TODAY_ENTITY_LABEL[table] ?? table}`)
          .join(' · ')}
      </p>
    </Card>
  );
}

export default async function SiteFlowHomePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const [user, projectsResult, { projectId }] = await Promise.all([
    getCurrentUser(),
    listMyFieldProjectsAction(undefined),
    searchParams,
  ]);

  const projects = projectsResult.ok ? projectsResult.data : [];

  if (projects.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">Halo,</p>
        <p className="text-[19px] font-semibold text-[color:var(--color-ink)]">{user?.fullName}</p>
        <p className="mt-3 text-sm text-[color:var(--color-ink-secondary)]">
          Anda belum terdaftar sebagai site coordinator/mandor di proyek manapun. Hubungi admin kantor.
        </p>
      </Card>
    );
  }

  const selectedProject = projectId !== undefined ? (projects.find((p) => p.id === projectId) ?? null) : null;

  if (selectedProject === null && projects.length > 1) {
    return (
      <div className="space-y-3">
        <p className="px-1 text-sm font-medium text-[color:var(--color-ink-secondary)]">Pilih proyek</p>
        {projects.map((project) => (
          <Link key={project.id} href={`/site?projectId=${project.id}`}>
            <Card interactive className="text-[17px] font-medium text-[color:var(--color-ink)] active:scale-[0.98]">
              {project.name}
            </Card>
          </Link>
        ))}
      </div>
    );
  }

  const project = selectedProject ?? projects[0]!;

  const activityResult = await listProjectActivityAction(project.id);
  const todayCounts = new Map<string, number>();
  if (activityResult.ok) {
    const today = new Date().toDateString();
    for (const event of activityResult.data) {
      if (new Date(event.occurredAt).toDateString() !== today) continue;
      todayCounts.set(event.entityTable, (todayCounts.get(event.entityTable) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">Proyek</p>
        <p className="text-[19px] font-semibold text-[color:var(--color-ink)]">{project.name}</p>
        {projects.length > 1 && (
          <Link href="/site" className="mt-1 inline-block text-xs font-medium text-[color:var(--color-accent)]">
            Ganti proyek
          </Link>
        )}
      </Card>

      <TodayActivitySummary counts={todayCounts} />

      <div className="grid grid-cols-2 gap-3.5">
        {MENU.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              // typedRoutes only recognises literal route strings, not a
              // template built from an array element -- these six are all
              // real pages under (siteflow)/site/, so the cast is safe.
              href={`/site/${item.href}?projectId=${project.id}` as Route}
            >
              <Card interactive className="flex min-h-[136px] flex-col justify-between active:scale-[0.97]">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[11px]"
                  style={{ backgroundColor: `${item.tint}1f` }}
                >
                  <Icon size={20} color={item.tint} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-[color:var(--color-ink-tertiary)]">{item.hint}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
