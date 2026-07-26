import { Users, Camera, ShieldCheck, Eye, UserPlus } from 'lucide-react';
import { Card, PageHeader, StatusBadge } from '@/core/ui';
import {
  listSubkonUsersAction,
  listClientPortalUsersAction,
  listProjectsForAccessAction,
  type ExternalUserWithProjects,
} from '@/modules/access-management/actions';
import { UnifiedInviteForm } from './UnifiedInviteForm';
import { RevokeButton } from './RevokeButton';

export const metadata = { title: 'Manajemen Akun — Arkavena OS' };

// ─── Role config ──────────────────────────────────────────────────────────────

type RoleConfigItem = {
  label: string;
  icon: React.ElementType;
  avatarClass: string;
  badgeClass: string;
};

const ROLE_CONFIG: Record<string, RoleConfigItem> = {
  subcontractor: {
    label: 'Subkontraktor',
    icon: Users,
    avatarClass: 'bg-violet-100 text-violet-700',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  photo_uploader: {
    label: 'Pengawas',
    icon: Camera,
    avatarClass: 'bg-orange-100 text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  client_approver: {
    label: 'Klien Approver',
    icon: ShieldCheck,
    avatarClass: 'bg-blue-100 text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  client_viewer: {
    label: 'Klien Viewer',
    icon: Eye,
    avatarClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
};

const DEFAULT_ROLE_CFG: RoleConfigItem = ROLE_CONFIG.subcontractor!;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
};


// ─── User card (shared) ───────────────────────────────────────────────────────

function UserCard({ user }: { user: ExternalUserWithProjects }) {
  const primaryRole = user.projects[0]?.role ?? 'subcontractor';
  const cfg = ROLE_CONFIG[primaryRole] ?? DEFAULT_ROLE_CFG;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cfg.avatarClass}`}>
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-medium text-[color:var(--color-ink)] truncate">{user.fullName}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.badgeClass}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-[color:var(--color-ink-tertiary)]">{user.email}</p>
          </div>
        </div>
        <StatusBadge tone={STATUS_TONE[user.status] ?? 'neutral'}>
          {user.status === 'invited' ? 'Belum login' : 'Aktif'}
        </StatusBadge>
      </div>

      {/* Projects */}
      {user.projects.length > 0 && (
        <div className="mt-2.5 ml-12 flex flex-wrap gap-2">
          {user.projects.map((proj) => {
            const projCfg = ROLE_CONFIG[proj.role] ?? DEFAULT_ROLE_CFG;
            const ProjIcon = projCfg.icon;
            return (
              <div
                key={proj.memberId}
                className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] pl-2.5 pr-1 py-1"
              >
                <ProjIcon className="h-3 w-3 text-[color:var(--color-ink-tertiary)]" />
                <span className="text-xs text-[color:var(--color-ink)]">{proj.projectName}</span>
                <RevokeButton
                  memberId={proj.memberId}
                  projectName={proj.projectName}
                  userName={user.fullName}
                />
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AkunPage() {
  const [subkonResult, clientResult, projectsResult] = await Promise.all([
    listSubkonUsersAction(undefined),
    listClientPortalUsersAction(undefined),
    listProjectsForAccessAction(undefined),
  ]);

  const subkonUsers = subkonResult.ok ? subkonResult.data : [];
  const clientUsers = clientResult.ok ? clientResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data : [];

  // All external users combined, deduplicated by userId
  const allUsersMap = new Map<string, ExternalUserWithProjects>();
  [...subkonUsers, ...clientUsers].forEach((u) => {
    if (allUsersMap.has(u.userId)) {
      // merge projects if same user has multiple roles
      const existing = allUsersMap.get(u.userId)!;
      existing.projects = [...existing.projects, ...u.projects];
    } else {
      allUsersMap.set(u.userId, { ...u, projects: [...u.projects] });
    }
  });

  const allUsers = Array.from(allUsersMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  const totalUsers = allUsersMap.size;

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Manajemen Akun"
        subtitle="Buat dan kelola akun login untuk subkontraktor, pengawas, dan klien dalam satu tempat."
      />

      {/* ── Create Account Form ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Buat Akun Baru</h2>
        </div>
        <Card>
          {/* Role legend */}
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

      {/* ── Existing Users List ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Akun Terdaftar</h2>
          <span className="ml-1 rounded-full bg-[color:var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-ink-secondary)]">
            {totalUsers} pengguna
          </span>
        </div>

        {allUsers.length === 0 ? (
          <Card>
            <p className="text-sm text-[color:var(--color-ink-secondary)] text-center py-4">
              Belum ada akun eksternal. Gunakan form di atas untuk membuat akun pertama.
            </p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-[color:var(--color-hairline)]">
              {allUsers.map((user) => (
                <UserCard key={user.userId} user={user} />
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-ink-tertiary)]">
          Keterangan Tipe Akun
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.subcontractor!.badgeClass}`}>
              <Users className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-medium text-[color:var(--color-ink)]">Subkontraktor</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Akses Partner Desk, pengajuan RAB, lihat PO, bisa di-assign ke banyak proyek</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.photo_uploader!.badgeClass}`}>
              <Camera className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-medium text-[color:var(--color-ink)]">Pengawas</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Subordinat subkon. Hanya bisa upload foto lapangan & lihat riwayat upload sendiri</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.client_approver!.badgeClass}`}>
              <ShieldCheck className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-medium text-[color:var(--color-ink)]">Klien Approver</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Akses portal klien, bisa approve/tolak proposal RAB & change order</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${ROLE_CONFIG.client_viewer!.badgeClass}`}>
              <Eye className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs font-medium text-[color:var(--color-ink)]">Klien Viewer</p>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">Akses portal klien, hanya bisa melihat progres proyek tanpa hak keputusan</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
