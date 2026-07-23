import { redirect } from 'next/navigation';
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">BuildTrust OS</p>
            <p className="text-xs text-slate-500">Partner Desk</p>
          </div>
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
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
