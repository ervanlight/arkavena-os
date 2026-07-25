import { listStaffUsersAction } from '@/core/auth/invite-staff-user';
import { Card, StatusBadge } from '@/core/ui';
import { InviteStaffUserForm } from './invite-staff-user-form';

export const metadata = { title: 'Tim — BuildTrust OS' };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  technical_director: 'Technical Director',
  finance: 'Finance',
  qs: 'QS',
  procurement: 'Procurement',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
};

export default async function TeamPage() {
  const result = await listStaffUsersAction(undefined);
  const staff = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Tim</h1>

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && staff.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {staff.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{user.full_name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-[color:var(--color-ink-secondary)]">
                    {user.org_role !== null ? (ROLE_LABELS[user.org_role] ?? user.org_role) : '—'}
                  </span>
                  <StatusBadge tone={STATUS_TONE[user.status] ?? 'neutral'}>{user.status}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-[15px] font-semibold text-[color:var(--color-ink)]">Undang staf baru</h2>
        <InviteStaffUserForm />
      </Card>
    </div>
  );
}
