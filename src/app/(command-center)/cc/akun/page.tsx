import { Users, Camera, ShieldCheck, Eye, UserPlus } from 'lucide-react';
import { Card, PageHeader } from '@/core/ui';
import { getAkunPageData } from '@/modules/access-management';
import { UnifiedInviteForm } from './UnifiedInviteForm';
import { UserAccountList } from './UserAccountList';

export const metadata = { title: 'Manajemen Akun — Arkavena OS' };

// ─── Role config for legend ───────────────────────────────────────────────────

type RoleConfigItem = {
  label: string;
  icon: React.ElementType;
  badgeClass: string;
};

const ROLE_CONFIG: Record<string, RoleConfigItem> = {
  subcontractor: {
    label: 'Subkontraktor',
    icon: Users,
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  photo_uploader: {
    label: 'Pengawas',
    icon: Camera,
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  client_approver: {
    label: 'Klien Approver',
    icon: ShieldCheck,
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  client_viewer: {
    label: 'Klien Viewer',
    icon: Eye,
    badgeClass: 'bg-slate-100 text-slate-600',
  },
};

export default async function AkunPage() {
  // High-performance single database batch fetch (0ms server action overhead)
  const { allUsers, projects } = await getAkunPageData();
  const totalUsers = allUsers.length;

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Manajemen Akun Pengguna"
        subtitle="Kelola ID login, password, dan hak akses untuk subkontraktor, pengawas, dan klien."
      />

      {/* ── Create Account Form ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Buat / Assign Akun</h2>
        </div>
        <Card>
          {/* Role legend header */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${cfg.badgeClass} bg-opacity-10`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium">{cfg.label}</span>
                </div>
              );
            })}
          </div>

          <UnifiedInviteForm projects={projects} />
        </Card>
      </section>

      {/* ── Existing Users List with Search & Filter ─────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Daftar Akun Terdaftar</h2>
          <span className="ml-1 rounded-full bg-[color:var(--color-surface-secondary)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-ink-secondary)]">
            {totalUsers} pengguna
          </span>
        </div>

        <UserAccountList allUsers={allUsers} />
      </section>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-ink-tertiary)]">
          Keterangan Tipe Akun
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.subcontractor!.badgeClass}`}>
              <Users className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--color-ink)]">Subkontraktor</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Akses Partner Desk, pengajuan RAB, lihat PO, bisa di-assign ke banyak proyek</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.photo_uploader!.badgeClass}`}>
              <Camera className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--color-ink)]">Pengawas</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Subordinat subkon. Hanya bisa upload foto lapangan & lihat riwayat upload sendiri</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.client_approver!.badgeClass}`}>
              <ShieldCheck className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--color-ink)]">Klien Approver</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Akses portal klien, bisa approve/tolak proposal RAB & change order</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.client_viewer!.badgeClass}`}>
              <Eye className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--color-ink)]">Klien Viewer</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Akses portal klien, hanya bisa melihat progres proyek tanpa hak keputusan</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
