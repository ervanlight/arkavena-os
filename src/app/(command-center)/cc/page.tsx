import Link from 'next/link';
import { 
  Inbox, 
  CheckSquare, 
  Receipt, 
  FileText, 
  GitPullRequest,
  Plus,
  Building2,
  ChevronRight
} from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { listOrgActivityAction, listProjectsAction } from '@/modules/projects';
import { Card, PageHeader, StatusBadge, EmptyState, Button } from '@/core/ui';
import { ActivityFeed } from '../_components/activity-feed';

export const metadata = { title: 'Command Center — Arkavena OS' };

const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const PROJECT_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  planning: 'neutral',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

const ACTIVE_STATUSES = new Set(['planning', 'in_progress', 'on_hold']);

export default async function CommandCenterHome() {
  const [user, projectsResult, activityResult] = await Promise.all([
    getCurrentUser(),
    listProjectsAction(undefined),
    listOrgActivityAction(undefined),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : 'Selamat sore';

  const allProjects = projectsResult.ok ? projectsResult.data : [];
  const activeProjects = allProjects.filter((p) => ACTIVE_STATUSES.has(p.status));
  const recentActivity = activityResult.ok ? activityResult.data : [];

  return (
    <div className="space-y-8">
      <PageHeader 
        title={`${greeting}, ${user?.fullName?.split(' ')[0] ?? ''}`} 
        subtitle="Berikut adalah hal-hal yang memerlukan keputusan Anda hari ini." 
      />

      {/* SECTION 1: TODAY'S WORK */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
          Pekerjaan Hari Ini
        </h2>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Action Card: Daily Reports */}
          <Card className="flex flex-col justify-between border-l-4 border-l-blue-500 p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Inbox size={16} />
                <span className="text-xs font-bold tracking-wider uppercase">Laporan Harian</span>
              </div>
              <h3 className="text-xl font-bold text-[color:var(--color-ink)]">18 <span className="text-sm font-normal text-[color:var(--color-ink-secondary)]">menunggu tinjauan</span></h3>
            </div>
            <div className="mt-4">
              <Link href={"/cc/daily-reports" as never}>
                <Button size="sm" variant="secondary" className="w-full justify-between">
                  Tinjau Laporan <ChevronRight size={14} />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Action Card: RAB Reviews */}
          <Card className="flex flex-col justify-between border-l-4 border-l-yellow-500 p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-yellow-600 mb-1">
                <CheckSquare size={16} />
                <span className="text-xs font-bold tracking-wider uppercase">RAB Subkontraktor</span>
              </div>
              <h3 className="text-xl font-bold text-[color:var(--color-ink)]">4 <span className="text-sm font-normal text-[color:var(--color-ink-secondary)]">penawaran baru</span></h3>
            </div>
            <div className="mt-4">
              <Link href={"/cc/review-center" as never}>
                <Button size="sm" variant="secondary" className="w-full justify-between">
                  Beri Keputusan <ChevronRight size={14} />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Action Card: Variations / Addendums */}
          <Card className="flex flex-col justify-between border-l-4 border-l-purple-500 p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <GitPullRequest size={16} />
                <span className="text-xs font-bold tracking-wider uppercase">Permintaan Addendum</span>
              </div>
              <h3 className="text-xl font-bold text-[color:var(--color-ink)]">2 <span className="text-sm font-normal text-[color:var(--color-ink-secondary)]">dari klien</span></h3>
            </div>
            <div className="mt-4">
              <Link href={"/cc/variations" as never}>
                <Button size="sm" variant="secondary" className="w-full justify-between">
                  Tinjau Permintaan <ChevronRight size={14} />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Action Card: Invoices */}
          <Card className="flex flex-col justify-between border-l-4 border-l-red-500 p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Receipt size={16} />
                <span className="text-xs font-bold tracking-wider uppercase">Tagihan Jatuh Tempo</span>
              </div>
              <h3 className="text-xl font-bold text-[color:var(--color-ink)]">1 <span className="text-sm font-normal text-[color:var(--color-ink-secondary)]">invoice menunggak</span></h3>
            </div>
            <div className="mt-4">
              <Link href="/cc/billing">
                <Button size="sm" variant="secondary" className="w-full justify-between">
                  Tindak Lanjuti <ChevronRight size={14} />
                </Button>
              </Link>
            </div>
          </Card>
          
          {/* Action Card: Documents */}
          <Card className="flex flex-col justify-between border-l-4 border-l-slate-500 p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <FileText size={16} />
                <span className="text-xs font-bold tracking-wider uppercase">Persetujuan Dokumen</span>
              </div>
              <h3 className="text-xl font-bold text-[color:var(--color-ink)]">3 <span className="text-sm font-normal text-[color:var(--color-ink-secondary)]">dokumen penting</span></h3>
            </div>
            <div className="mt-4">
              <Link href={"/cc/documents" as never}>
                <Button size="sm" variant="secondary" className="w-full justify-between">
                  Buka Berkas <ChevronRight size={14} />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* SECTION 4: QUICK ACTIONS (Moved up for better inbox feel) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
          Tindakan Cepat
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/cc/projects/new">
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-full px-4 border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
              <Plus size={14} /> Buat Proyek
            </Button>
          </Link>
          <Link href="/cc/billing">
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-full px-4 border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
              <Plus size={14} /> Buat Invoice
            </Button>
          </Link>
          <Link href={"/cc/variations" as never}>
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-full px-4 border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
              <Plus size={14} /> Addendum Baru
            </Button>
          </Link>
          <Link href={"/cc/subcontractors" as never}>
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-full px-4 border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
              <Plus size={14} /> Tambah Subkon
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* SECTION 2: ACTIVE PROJECTS */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
            Proyek Aktif
          </h2>
          {activeProjects.length === 0 ? (
            <EmptyState title="Belum ada proyek aktif" description="Proyek yang sedang berjalan akan muncul di sini." />
          ) : (
            <Card className="p-0 overflow-hidden">
              <ul className="divide-y divide-[color:var(--color-hairline)]">
                {activeProjects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/cc/projects/${project.id}` as never} className="block hover:bg-[color:var(--color-surface-hover)] transition-colors p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-canvas)] text-[color:var(--color-ink-secondary)]">
                            <Building2 size={20} strokeWidth={1.5} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">{project.name}</p>
                            <p className="text-xs text-[color:var(--color-ink-tertiary)] mt-0.5">
                              Laporan terakhir: Hari ini
                            </p>
                          </div>
                        </div>
                        <StatusBadge tone={PROJECT_STATUS_TONE[project.status] ?? 'neutral'}>
                          {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                        </StatusBadge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* SECTION 3: RECENT ACTIVITY */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
            Aktivitas Terbaru
          </h2>
          <Card className="p-4">
            <ActivityFeed events={recentActivity} />
          </Card>
        </section>
      </div>
      
    </div>
  );
}
