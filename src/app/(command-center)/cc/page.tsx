import { getCurrentUser } from '@/core/auth/session';

export const metadata = { title: 'Command Center — BuildTrust OS' };

/**
 * Landing page. The layout already guarantees a signed-in user (redirects
 * otherwise), so this only needs to show who is signed in.
 */
export default async function CommandCenterHome() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-4 rounded-lg bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Selamat datang, {user?.fullName}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Organisasi</dt>
        <dd className="text-slate-900">{user?.organizationName}</dd>
        <dt className="text-slate-500">Peran</dt>
        <dd className="text-slate-900">{user?.orgRole ?? '—'}</dd>
        <dt className="text-slate-500">Status</dt>
        <dd className="text-slate-900">{user?.status}</dd>
      </dl>
    </div>
  );
}
