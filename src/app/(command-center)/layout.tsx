import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/magic-link';

/**
 * Shared shell for every Command Center page (owner, TD, finance, QS, ...).
 * Redirects unauthenticated visitors -- proxy.ts already does this for every
 * route, but a layout that assumes a user exists should not rely solely on
 * something outside itself to guarantee that.
 */
export default async function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user === null) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/cc" className="font-semibold text-slate-900">
              BuildTrust OS
            </Link>
            <Link href="/cc/clients" className="text-slate-600 hover:text-slate-900">
              Klien
            </Link>
            <Link href="/cc/projects" className="text-slate-600 hover:text-slate-900">
              Proyek
            </Link>
            <Link href="/cc/quality-gate" className="text-slate-600 hover:text-slate-900">
              Quality Gate
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{user.fullName}</span>
            <form
              action={async () => {
                'use server';
                await signOut();
                redirect('/login');
              }}
            >
              <button type="submit" className="font-medium text-slate-600 underline hover:text-slate-900">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
