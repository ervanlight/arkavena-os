import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Camera, FileText, AlertTriangle, Building2, CheckCircle2 } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { listMyFieldProjectsAction, getMyProjectRolesAction } from '@/modules/projects';
import { Card, StatusBadge } from '@/core/ui';

export const metadata = { title: 'SiteFlow — Arkavena OS' };

export default async function SiteFlowHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [projectsResult, rolesResult] = await Promise.all([
    listMyFieldProjectsAction(undefined),
    getMyProjectRolesAction(undefined),
  ]);

  const projects = projectsResult.ok ? projectsResult.data : [];
  const roles = rolesResult.ok ? rolesResult.data : [];
  const isPhotoUploaderOnly = roles.includes('photo_uploader') && !roles.includes('site_coordinator') && !roles.includes('mandor');

  const firstFieldProject = projects[0];
  // If user is purely a Pengawas (photo_uploader), redirect straight to photo uploader page with project ID
  if (isPhotoUploaderOnly && firstFieldProject) {
    redirect(`/site/foto?projectId=${firstFieldProject.id}`);
  }

  if (projects.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">Halo,</p>
        <p className="text-[19px] font-semibold text-[color:var(--color-ink)]">{user.fullName}</p>
        <p className="mt-3 text-sm text-[color:var(--color-ink-secondary)]">
          Anda belum terdaftar sebagai pengawas/site coordinator/mandor di proyek manapun. Hubungi admin kantor Arkavena.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-lg mx-auto">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">SiteFlow Lapangan</h1>
        <p className="text-[15px] text-[color:var(--color-ink-secondary)] mt-1">
          Selamat datang, <span className="font-semibold text-[color:var(--color-ink)]">{user.fullName}</span>. Pilih aksi proyek di bawah ini.
        </p>
      </header>

      {/* Quick Action Hub per Project */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[color:var(--color-ink)]">Proyek Aktif ({projects.length})</h2>
        {projects.map((project) => (
          <Card key={project.id} className="p-4 space-y-3 border-l-4 border-l-[color:var(--color-accent)]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-[16px] text-[color:var(--color-ink)] flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[color:var(--color-accent)]" />
                  {project.name}
                </h3>
              </div>
              <StatusBadge tone="info">Aktif</StatusBadge>
            </div>

            {/* Project Quick Links */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[color:var(--color-hairline)]">
              <Link
                href={`/site/foto?projectId=${project.id}` as Route}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] hover:bg-[color:var(--color-surface)] text-xs font-medium text-[color:var(--color-ink)] transition-colors"
              >
                <Camera className="h-4 w-4 text-violet-600 shrink-0" />
                <span>Upload Foto</span>
              </Link>

              <Link
                href={`/site/laporan-harian?projectId=${project.id}` as Route}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] hover:bg-[color:var(--color-surface)] text-xs font-medium text-[color:var(--color-ink)] transition-colors"
              >
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Laporan Harian</span>
              </Link>
            </div>
          </Card>
        ))}
      </section>

      {/* Quick Actions Footer for ad-hoc submissions */}
      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--color-canvas)] border-t border-[color:var(--color-hairline)] p-3 glass flex justify-around pb-safe max-w-lg mx-auto">
        <Link href={"/site/riwayat" as never} className="flex flex-col items-center gap-1 text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]">
          <FileText size={22} strokeWidth={1.5} />
          <span className="text-[11px] font-medium">Riwayat</span>
        </Link>
        <Link href="/site/foto" className="flex flex-col items-center gap-1 text-[color:var(--color-accent)] font-semibold">
          <Camera size={22} strokeWidth={2} />
          <span className="text-[11px]">Kamera</span>
        </Link>
        <Link href="/site/masalah" className="flex flex-col items-center gap-1 text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]">
          <AlertTriangle size={22} strokeWidth={1.5} />
          <span className="text-[11px] font-medium">Lapor Masalah</span>
        </Link>
        <Link href={"/site/payments" as never} className="flex flex-col items-center gap-1 text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]">
          <CheckCircle2 size={22} strokeWidth={1.5} />
          <span className="text-[11px] font-medium">Bayar</span>
        </Link>
      </div>
    </div>
  );
}
