import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/login';
import { Logo } from '@/core/ui';

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user === null) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <div>
              <p className="text-[15px] font-semibold leading-tight text-white">Arkavena OS</p>
              <p className="text-[11px] leading-tight text-gray-400">Portal Klien</p>
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
              aria-label="Keluar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
