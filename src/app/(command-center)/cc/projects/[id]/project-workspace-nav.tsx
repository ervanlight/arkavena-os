'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { suffix: '', label: 'Ringkasan' },
  { suffix: '/aktivitas', label: 'Aktivitas' },
  { suffix: '/foto', label: 'Foto' },
  { suffix: '/laporan', label: 'Laporan' },
  { suffix: '/rab', label: 'RAB' },
  { suffix: '/variations', label: 'Variation' },
  { suffix: '/invoices', label: 'Invoice' },
] as const;

/**
 * The horizontal tab bar that turns a project's scattered sub-pages into one
 * workspace. A client component so it can read `usePathname()` to mark the
 * active tab -- the layout that renders it is a server component and has no
 * clean way to know which child route is showing. Horizontal-scrolls on
 * narrow widths rather than wrapping, same pattern as the client portal nav.
 */
export function ProjectWorkspaceNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/cc/projects/${projectId}`;

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const isActive = tab.suffix === '' ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.suffix}
            href={href as Route}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              isActive
                ? 'bg-[color:var(--color-ink)] text-white'
                : 'bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-hairline)]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
