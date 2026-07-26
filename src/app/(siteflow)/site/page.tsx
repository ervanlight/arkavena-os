import Link from 'next/link';
import type { Route } from 'next';
import { FileUp, FileCheck2, Camera, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { listMyFieldProjectsAction } from '@/modules/projects';
import { Card, Button, StatusBadge } from '@/core/ui';

export const metadata = { title: 'SiteFlow — Arkavena OS' };

// Mock data for Task Inbox (in a real app, this would come from a server action)
const MOCK_TASKS = [
  {
    id: 't-1',
    projectId: 'p-1',
    projectName: 'Rumah Bapak Andi',
    title: 'Laporan Harian',
    type: 'upload_report',
    dueDate: 'Hari Ini',
    status: 'pending',
    priority: 'high',
    href: '/site/laporan-harian',
    actionText: 'Isi Laporan',
    icon: FileUp,
    iconColor: 'text-blue-500',
  },
  {
    id: 't-2',
    projectId: 'p-2',
    projectName: 'Cafe ABC',
    title: 'Revisi Foto Kurang Jelas',
    type: 'revision_requested',
    dueDate: 'Secepatnya',
    status: 'revision_required',
    priority: 'high',
    href: '/site/tasks/revision',
    actionText: 'Perbaiki Sekarang',
    icon: AlertCircle,
    iconColor: 'text-red-500',
  },
  {
    id: 't-3',
    projectId: 'p-1',
    projectName: 'Rumah Bapak Andi',
    title: 'Pengajuan RAB Addendum Atap',
    type: 'submit_rab',
    dueDate: 'Besok',
    status: 'pending',
    priority: 'medium',
    href: '/site/tasks/rab',
    actionText: 'Buat RAB',
    icon: FileCheck2,
    iconColor: 'text-orange-500',
  }
];

export default async function SiteFlowHomePage() {
  const user = await getCurrentUser();
  const projectsResult = await listMyFieldProjectsAction(undefined);
  const projects = projectsResult.ok ? projectsResult.data : [];

  if (projects.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">Halo,</p>
        <p className="text-[19px] font-semibold text-[color:var(--color-ink)]">{user?.fullName}</p>
        <p className="mt-3 text-sm text-[color:var(--color-ink-secondary)]">
          Anda belum terdaftar sebagai site coordinator/mandor di proyek manapun. Hubungi admin kantor Arkavena.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Tugas Hari Ini</h1>
        <p className="text-[15px] text-[color:var(--color-ink-secondary)] mt-1">
          Selesaikan tugas di bawah ini untuk melaporkan progres lapangan.
        </p>
      </header>

      <section className="space-y-4">
        {MOCK_TASKS.map(task => {
          const Icon = task.icon;
          return (
            <Card key={task.id} className="p-4 border-l-4" style={{ borderLeftColor: task.iconColor.replace('text-', '').replace('-500', '') === 'blue' ? '#3b82f6' : task.iconColor.includes('red') ? '#ef4444' : '#f97316' }}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={task.iconColor} size={18} />
                  <span className="text-xs font-bold tracking-wider uppercase text-[color:var(--color-ink-secondary)]">{task.type.replace('_', ' ')}</span>
                </div>
                {task.priority === 'high' && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Urgent</span>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-[color:var(--color-ink)]">{task.title}</h3>
              <p className="text-sm text-[color:var(--color-ink-secondary)] mb-4">Proyek: <span className="font-medium text-[color:var(--color-ink)]">{task.projectName}</span></p>
              
              <div className="flex items-center justify-between mt-2 pt-3 border-t border-[color:var(--color-hairline)]">
                <p className="text-xs font-medium text-[color:var(--color-ink-tertiary)] flex items-center gap-1">
                  Batas waktu: <span className="text-[color:var(--color-ink)]">{task.dueDate}</span>
                </p>
                <Link href={`${task.href}?projectId=${task.projectId}` as Route}>
                  <Button size="sm" variant={task.priority === 'high' ? 'primary' : 'secondary'}>
                    {task.actionText}
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="pt-6">
        <h2 className="text-lg font-bold text-[color:var(--color-ink)] mb-3">Proyek Aktif</h2>
        <div className="space-y-3">
          {projects.map(project => (
            <Link key={project.id} href={`/site/projects/${project.id}` as Route} className="block">
              <Card interactive className="active:scale-[0.98] p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-[15px] text-[color:var(--color-ink)]">{project.name}</h3>
                    <p className="text-[13px] text-[color:var(--color-ink-secondary)] mt-0.5">Fase Struktur</p>
                  </div>
                  <StatusBadge tone="info">Berjalan</StatusBadge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Actions Footer for ad-hoc submissions */}
      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--color-canvas)] border-t border-[color:var(--color-hairline)] p-4 glass flex justify-around pb-safe">
         <Link href={"/site/payments" as never} className="flex flex-col items-center gap-1 text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]">
            <CheckCircle2 size={24} strokeWidth={1.5} />
            <span className="text-[11px] font-medium">Pembayaran</span>
         </Link>
         <Link href="/site/foto" className="flex flex-col items-center gap-1 text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]">
            <Camera size={24} strokeWidth={1.5} />
            <span className="text-[11px] font-medium">Kamera</span>
         </Link>
         <Link href="/site/masalah" className="flex flex-col items-center gap-1 text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]">
            <AlertTriangle size={24} strokeWidth={1.5} />
            <span className="text-[11px] font-medium">Lapor Masalah</span>
         </Link>
      </div>
    </div>
  );
}
