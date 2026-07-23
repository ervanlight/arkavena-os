import { listStaffUsersAction } from '@/core/auth/invite-staff-user';
import { InviteStaffUserForm } from './invite-staff-user-form';

export const metadata = { title: 'Tim — BuildTrust OS' };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  technical_director: 'Technical Director',
  finance: 'Finance',
  qs: 'QS',
  procurement: 'Procurement',
};

export default async function TeamPage() {
  const result = await listStaffUsersAction(undefined);
  const staff = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tim</h1>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && staff.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Peran</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{user.full_name}</td>
                  <td className="px-4 py-2 text-slate-600">{user.email}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {user.org_role !== null ? (ROLE_LABELS[user.org_role] ?? user.org_role) : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Undang staf baru</h2>
        <InviteStaffUserForm />
      </div>
    </div>
  );
}
