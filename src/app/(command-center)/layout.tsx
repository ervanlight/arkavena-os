import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Home,
  Users,
  TrendingUp,
  ClipboardList,
  Building2,
  Truck,
  BookOpen,
  ShieldCheck,
  Package,
  Award,
  Receipt,
  UsersRound,
  LogOut,
} from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { signOut } from '@/core/auth/login';

const NAV_ITEMS = [
  { href: '/cc', label: 'Ringkasan', icon: Home },
  { href: '/cc/clients', label: 'Klien', icon: Users },
  { href: '/cc/leads', label: 'Leads', icon: TrendingUp },
  { href: '/cc/assessments', label: 'Assessment', icon: ClipboardList },
  { href: '/cc/projects', label: 'Proyek', icon: Building2 },
  { href: '/cc/vendors', label: 'Vendor', icon: Truck },
  { href: '/cc/cost-library', label: 'Cost Library', icon: BookOpen },
  { href: '/cc/quality-gate', label: 'Quality Gate', icon: ShieldCheck },
  { href: '/cc/assets', label: 'Aset', icon: Package },
  { href: '/cc/warranties', label: 'Garansi', icon: Award },
  { href: '/cc/billing', label: 'Billing', icon: Receipt },
  { href: '/cc/team', label: 'Tim', icon: UsersRound },
] satisfies { href: Route; label: string; icon: typeof Home }[];

/**
 * Shared shell for every Command Center page (owner, TD, finance, QS, ...).
 * A macOS System Settings-style icon+label sidebar (Owner request,
 * 2026-07-23 -- "rombak" the previous flat top-nav into something that reads
 * as a modern desktop/App Store app), rather than the 11-item horizontal nav
 * this replaces, which no longer fit comfortably as the module count grew.
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
    <div className="flex min-h-screen bg-[color:var(--color-canvas)]">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] px-3 py-5">
        <Link href="/cc" className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[color:var(--color-ink)] text-sm font-bold text-white">
            B
          </div>
          <span className="text-[15px] font-semibold text-[color:var(--color-ink)]">Arkavena OS</span>
        </Link>

        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium text-[color:var(--color-ink-secondary)] transition-colors hover:bg-[color:var(--color-accent)]/10 hover:text-[color:var(--color-accent-hover)]"
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t border-[color:var(--color-hairline)] pt-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="truncate text-[13px] text-[color:var(--color-ink-tertiary)]">{user.fullName}</span>
            <form
              action={async () => {
                'use server';
                await signOut();
                redirect('/login');
              }}
            >
              <button
                type="submit"
                title="Keluar"
                aria-label="Keluar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-ink-tertiary)] hover:bg-[color:var(--color-danger)]/10 hover:text-[color:var(--color-danger)]"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
