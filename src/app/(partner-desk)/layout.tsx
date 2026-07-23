import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/login';

/**
 * Shared shell for Partner Desk (Fase 11, ADR 0024) -- same plain,
 * role-agnostic shell as (client-portal)/layout.tsx: no project-role check
 * here, RLS and the permission matrix are the real gate (CLAUDE.md law 0.1
 * law 3), this is cosmetic routing only.
 */
export default async function PartnerDeskLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user === null) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-canvas)]">
      <header className="glass sticky top-0 z-10 border-b border-[color:var(--color-hairline)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[color:var(--color-ink)] text-sm font-bold text-white">
              B
            </div>
            <div>
              <p className="text-[15px] font-semibold leading-tight text-[color:var(--color-ink)]">BuildTrust OS</p>
              <p className="text-[11px] leading-tight text-[color:var(--color-ink-tertiary)]">Partner Desk</p>
            </div>
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-ink-tertiary)] hover:bg-[color:var(--color-danger)]/10 hover:text-[color:var(--color-danger)]"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
