import type { Route } from 'next';
import Link from 'next/link';

const TABS = [
  { href: '', label: 'Beranda' },
  { href: '/laporan-mingguan', label: 'Laporan Mingguan' },
] as const;

/** An iOS-style segmented scroller rather than a plain underlined tab row. */
export function PortalNav({ projectId, active }: { projectId: string; active: (typeof TABS)[number]['href'] }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={`/portal/${projectId}${tab.href}` as Route}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            tab.href === active
              ? 'bg-[color:var(--color-ink)] text-white'
              : 'bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-hairline)]'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
