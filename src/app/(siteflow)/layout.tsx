import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/login';
import { InstallBanner } from '@/core/pwa/install-banner';
import { Logo } from '@/core/ui';
import { OutboxSync } from './outbox-sync';

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
    <div className="min-h-screen bg-[color:var(--color-canvas)]">
      <OutboxSync />
      <InstallBanner />
      <header className="glass sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--color-hairline)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-[17px] font-semibold text-[color:var(--color-ink)]">SiteFlow</span>
        </div>
        <form
          action={async () => {
            'use server';
            await signOut();
            redirect('/login');
          }}
        >
          <button
            type="submit"
            aria-label="Keluar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-ink-tertiary)] active:bg-[color:var(--color-danger)]/10 active:text-[color:var(--color-danger)]"
          >
            <LogOut size={16} />
          </button>
        </form>
      </header>
      <main className="px-4 py-5">{children}</main>
    </div>
  );
}
