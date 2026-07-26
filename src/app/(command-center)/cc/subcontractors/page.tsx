import { Users, Camera, UserPlus } from 'lucide-react';
import { Card, PageHeader, EmptyState, StatusBadge } from '@/core/ui';
import {
  listSubkonUsersAction,
  listProjectsForAccessAction,
} from '@/modules/access-management/actions';
import { InviteSubkonForm } from './InviteSubkonForm';
import { RevokeAccessButton } from './RevokeAccessButton';

export const metadata = { title: 'Subkontraktor — Arkavena OS' };

const ROLE_LABELS: Record<string, { label: string; icon: typeof Users }> = {
  subcontractor: { label: 'Subkontraktor', icon: Users },
  photo_uploader: { label: 'Foto Uploader', icon: Camera },
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
};

export default async function SubcontractorsPage() {
  const [usersResult, projectsResult] = await Promise.all([
    listSubkonUsersAction(undefined),
    listProjectsForAccessAction(undefined),
  ]);

  const users = usersResult.ok ? usersResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data : [];

  // Separate subkon from photo uploaders
  const subkonUsers = users.filter((u) => u.projects.some((p) => p.role === 'subcontractor'));
  const uploaderUsers = users.filter(
    (u) => u.projects.every((p) => p.role === 'photo_uploader'),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Subkontraktor"
        subtitle="Kelola akun login dan akses proyek untuk subkontraktor dan tim upload foto mereka."
      />

      {/* ── Subkontraktor List ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Subkontraktor</h2>
          <span className="ml-1 rounded-full bg-[color:var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-ink-secondary)]">
            {subkonUsers.length}
          </span>
        </div>

        {subkonUsers.length === 0 ? (
          <EmptyState
            title="Belum ada subkontraktor"
            description="Gunakan form di bawah untuk membuat akun login bagi subkontraktor."
          />
        ) : (
          <Card>
            <ul className="divide-y divide-[color:var(--color-hairline)]">
              {subkonUsers.map((user) => (
                <li key={user.userId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    {/* Avatar + info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-bold">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[color:var(--color-ink)] truncate">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-[color:var(--color-ink-tertiary)]">{user.email}</p>
                      </div>
                    </div>
                    {/* Status */}
                    <StatusBadge tone={STATUS_TONE[user.status] ?? 'neutral'}>
                      {user.status === 'invited' ? 'Belum login' : 'Aktif'}
                    </StatusBadge>
                  </div>

                  {/* Projects */}
                  <div className="mt-3 ml-12 space-y-1.5">
                    <p className="text-xs font-medium text-[color:var(--color-ink-tertiary)] uppercase tracking-wide">
                      Proyek yang diakses
                    </p>
                    {user.projects.map((proj) => {
                      const roleInfo = ROLE_LABELS[proj.role] ?? { label: proj.role, icon: Users };
                      const Icon = roleInfo.icon;
                      return (
                        <div
                          key={proj.memberId}
                          className="flex items-center justify-between rounded-lg bg-[color:var(--color-surface-secondary)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-[color:var(--color-ink-tertiary)]" />
                            <span className="text-sm text-[color:var(--color-ink)]">{proj.projectName}</span>
                            <span className="text-xs text-[color:var(--color-ink-tertiary)]">
                              · {roleInfo.label}
                            </span>
                          </div>
                          <RevokeAccessButton
                            memberId={proj.memberId}
                            projectName={proj.projectName}
                            userName={user.fullName}
                          />
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Foto Uploader List ─────────────────────────────────────────── */}
      {uploaderUsers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
            <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Foto Uploader</h2>
            <span className="ml-1 rounded-full bg-[color:var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-ink-secondary)]">
              {uploaderUsers.length}
            </span>
          </div>
          <p className="text-sm text-[color:var(--color-ink-secondary)]">
            Akun ini hanya dapat mengupload foto lapangan dan melihat riwayat upload mereka sendiri.
          </p>
          <Card>
            <ul className="divide-y divide-[color:var(--color-hairline)]">
              {uploaderUsers.map((user) => (
                <li key={user.userId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-sm font-bold">
                        <Camera className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[color:var(--color-ink)] truncate">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-[color:var(--color-ink-tertiary)]">{user.email}</p>
                      </div>
                    </div>
                    <StatusBadge tone={STATUS_TONE[user.status] ?? 'neutral'}>
                      {user.status === 'invited' ? 'Belum login' : 'Aktif'}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 ml-12 space-y-1.5">
                    {user.projects.map((proj) => (
                      <div
                        key={proj.memberId}
                        className="flex items-center justify-between rounded-lg bg-[color:var(--color-surface-secondary)] px-3 py-2"
                      >
                        <span className="text-sm text-[color:var(--color-ink)]">{proj.projectName}</span>
                        <RevokeAccessButton
                          memberId={proj.memberId}
                          projectName={proj.projectName}
                          userName={user.fullName}
                        />
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* ── Invite Form ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Buat Akun Baru</h2>
        </div>

        {projects.length === 0 ? (
          <Card>
            <p className="text-sm text-[color:var(--color-ink-secondary)]">
              Belum ada proyek. Buat proyek terlebih dahulu sebelum mengundang subkontraktor.
            </p>
          </Card>
        ) : (
          <Card>
            <p className="mb-5 text-sm text-[color:var(--color-ink-secondary)] leading-relaxed">
              Buat akun login untuk subkontraktor atau tim foto uploader mereka. Setelah akun dibuat, 
              password sementara akan ditampilkan untuk disampaikan kepada pengguna.
            </p>
            <InviteSubkonForm projects={projects} />
          </Card>
        )}
      </section>
    </div>
  );
}
