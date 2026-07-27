import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/login';

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user === null) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#151515] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1A1A1A]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Arkavena Logo" className="h-8 w-8 rounded-[10px] object-cover shadow-sm" />
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
