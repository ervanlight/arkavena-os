import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/magic-link';

export const metadata = { title: 'Command Center — BuildTrust OS' };

/**
 * The Fase 0 landing page. Its only job is to prove the login flow and org
 * context work end to end -- exit criteria in ARCHITECTURE.md 7. Every
 * Command Center module (projects, cash gate, billing, ...) replaces this in
 * its own phase.
 */
export default async function CommandCenterHome() {
  const user = await getCurrentUser();

  if (user === null) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-xl space-y-4 rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Selamat datang, {user.fullName}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Organisasi</dt>
          <dd className="text-slate-900">{user.organizationName}</dd>
          <dt className="text-slate-500">Peran</dt>
          <dd className="text-slate-900">{user.orgRole ?? '—'}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd className="text-slate-900">{user.status}</dd>
        </dl>
        <form
          action={async () => {
            'use server';
            await signOut();
            redirect('/login');
          }}
        >
          <button
            type="submit"
            className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
          >
            Keluar
          </button>
        </form>
      </div>
    </main>
  );
}
