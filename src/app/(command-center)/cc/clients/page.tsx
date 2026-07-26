import Link from 'next/link';
import { Building2, ShieldCheck, Eye, UserPlus } from 'lucide-react';
import { listClientsAction } from '@/modules/crm';
import { Card, PageHeader, EmptyState, StatusBadge } from '@/core/ui';
import { listClientPortalUsersAction, listProjectsForAccessAction } from '@/modules/access-management/actions';
import { InviteClientPortalForm } from './InviteClientPortalForm';
import { RevokeClientAccessButton } from './RevokeClientAccessButton';

export const metadata = { title: 'Klien — Arkavena OS' };

const ROLE_LABELS: Record<string, { label: string; icon: typeof ShieldCheck; color: string }> = {
  client_approver: { label: 'Approver', icon: ShieldCheck, color: 'text-blue-600' },
  client_viewer: { label: 'Viewer', icon: Eye, color: 'text-gray-500' },
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
};

export default async function ClientsPage() {
  const [clientsResult, portalUsersResult, projectsResult] = await Promise.all([
    listClientsAction(undefined),
    listClientPortalUsersAction(undefined),
    listProjectsForAccessAction(undefined),
  ]);

  const clients = clientsResult.ok ? clientsResult.data : [];
  const portalUsers = portalUsersResult.ok ? portalUsersResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Klien"
        subtitle="Kelola data klien dan akses portal klien."
        actions={
          <Link
            href="/cc/clients/new"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[color:var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white hover:bg-[color:var(--color-accent-hover)]"
          >
            Tambah klien
          </Link>
        }
      />

      {/* ── Direktori Klien (CRM) ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Direktori Klien</h2>
          <span className="ml-1 rounded-full bg-[color:var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-ink-secondary)]">
            {clients.length}
          </span>
        </div>

        {!clientsResult.ok && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {clientsResult.error.message}
          </p>
        )}

        {clientsResult.ok && clients.length === 0 ? (
          <EmptyState title="Belum ada klien" description="Tambahkan klien pertama Anda." />
        ) : (
          <Card>
            <ul className="divide-y divide-[color:var(--color-hairline)]">
              {clients.map((client) => (
                <li key={client.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">
                      {client.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                      {client.contact_name ?? '—'} · {client.email ?? '—'}
                    </p>
                  </div>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)] shrink-0">{client.phone ?? '—'}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Akses Portal Klien ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Akses Portal Klien</h2>
          <span className="ml-1 rounded-full bg-[color:var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-ink-secondary)]">
            {portalUsers.length} pengguna
          </span>
        </div>

        {portalUsers.length === 0 ? (
          <EmptyState
            title="Belum ada pengguna portal"
            description="Gunakan form di bawah untuk membuat akun portal bagi klien."
          />
        ) : (
          <Card>
            <ul className="divide-y divide-[color:var(--color-hairline)]">
              {portalUsers.map((user) => (
                <li key={user.userId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                        {user.fullName.charAt(0).toUpperCase()}
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

                  {/* Projects */}
                  <div className="mt-3 ml-12 space-y-1.5">
                    {user.projects.map((proj) => {
                      const roleInfo = ROLE_LABELS[proj.role] ?? { label: proj.role, icon: Eye, color: 'text-gray-500' };
                      const Icon = roleInfo.icon;
                      return (
                        <div
                          key={proj.memberId}
                          className="flex items-center justify-between rounded-lg bg-[color:var(--color-surface-secondary)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-3.5 w-3.5 ${roleInfo.color}`} />
                            <span className="text-sm text-[color:var(--color-ink)]">{proj.projectName}</span>
                            <span className={`text-xs font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                          </div>
                          <RevokeClientAccessButton
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

      {/* ── Invite Form ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[color:var(--color-ink-secondary)]" />
          <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Buat Akun Portal Klien</h2>
        </div>

        {projects.length === 0 ? (
          <Card>
            <p className="text-sm text-[color:var(--color-ink-secondary)]">
              Belum ada proyek. Buat proyek terlebih dahulu sebelum membuat akun portal klien.
            </p>
          </Card>
        ) : (
          <Card>
            <p className="mb-5 text-sm text-[color:var(--color-ink-secondary)] leading-relaxed">
              Buat akun login untuk klien agar mereka bisa memantau progres proyek, menyetujui proposal RAB, 
              dan menerima dokumen penting lewat portal khusus mereka.
            </p>
            <InviteClientPortalForm projects={projects} />
          </Card>
        )}
      </section>
    </div>
  );
}
