import { getCurrentUser } from '@/core/auth/session';

export const metadata = { title: 'SiteFlow — BuildTrust OS' };

/**
 * The SiteFlow landing page. This is a real, working page for the
 * FR4 slice (auth guard + redirect land here correctly) -- the six
 * big-button daily-report menu itself is FR8's job, once
 * modules/field-reporting (FR6) exists for it to call into.
 */
export default async function SiteFlowHomePage() {
  const user = await getCurrentUser();

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">Halo,</p>
      <p className="text-lg font-semibold text-slate-900">{user?.fullName}</p>
      <p className="mt-1 text-sm text-slate-500">{user?.organizationName}</p>
    </div>
  );
}
