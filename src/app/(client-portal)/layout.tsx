import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/login';

/**
 * Shared shell for the whole client-portal route group (ADR 0016, "approval
 * variation pindah ke portal") -- including /variations/[id]/approve, the
 * one-off secure link Fase 3 built before this portal existed. Deliberately
 * plain: this is the one screen ARCHITECTURE.md calls "wajah perusahaan ke
 * klien" (CHECKPOINT #4), so it says nothing about internal roles, work
 * types, or QC mechanics -- just the company name and a way to sign out.
 * No project-role check here either, same philosophy as the Command Center
 * and SiteFlow layouts (CLAUDE.md 0.1 law 3): RLS and the permission matrix
 * are the real gate, this is cosmetic routing.
 */
export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
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
            <p className="text-xs text-slate-500">Portal Klien</p>
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
