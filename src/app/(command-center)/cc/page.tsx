import { getCurrentUser } from '@/core/auth/session';
import { Card, PageHeader, StatusBadge } from '@/core/ui';

export const metadata = { title: 'Command Center — BuildTrust OS' };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  technical_director: 'Technical Director',
  finance: 'Finance',
  qs: 'QS',
  procurement: 'Procurement',
};

/**
 * Landing page. The layout already guarantees a signed-in user (redirects
 * otherwise), so this only needs to show who is signed in.
 */
export default async function CommandCenterHome() {
  const user = await getCurrentUser();
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : 'Selamat sore';

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting}, ${user?.fullName?.split(' ')[0] ?? ''}`} subtitle={user?.organizationName} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Peran</p>
          <p className="mt-1.5 text-[17px] font-semibold text-[color:var(--color-ink)]">
            {user?.orgRole !== null && user?.orgRole !== undefined ? (ROLE_LABELS[user.orgRole] ?? user.orgRole) : '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Status</p>
          <div className="mt-2">
            <StatusBadge tone={user?.status === 'active' ? 'success' : 'neutral'}>{user?.status}</StatusBadge>
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Organisasi</p>
          <p className="mt-1.5 truncate text-[17px] font-semibold text-[color:var(--color-ink)]">{user?.organizationName}</p>
        </Card>
      </div>
    </div>
  );
}
