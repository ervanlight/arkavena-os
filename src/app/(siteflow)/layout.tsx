import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/magic-link';
import { InstallBanner } from '@/core/pwa/install-banner';

/**
 * Shared shell for every SiteFlow page (/site/*). Deliberately none of the
 * Command Center's desktop chrome (max-w-5xl container, horizontal nav) --
 * this is a phone screen held by a mandor, not a desk. No `PROJECT_ROLES`
 * check here either, matching the Command Center layout's own philosophy
 * (CLAUDE.md 0.1 law 3): routing is cosmetic, RLS and the permission matrix
 * are the real gate, so any signed-in user reaching /site sees only what
 * their own rows allow.
 */
export default async function SiteFlowLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user === null) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <InstallBanner />
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-base font-semibold text-slate-900">SiteFlow</span>
        <form
          action={async () => {
            'use server';
            await signOut();
            redirect('/login');
          }}
        >
          <button type="submit" className="text-sm font-medium text-slate-500 underline">
            Keluar
          </button>
        </form>
      </header>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
