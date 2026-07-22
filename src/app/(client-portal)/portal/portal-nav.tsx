import type { Route } from 'next';
import Link from 'next/link';

const TABS = [
  { href: '', label: 'Ringkasan' },
  { href: '/zona', label: 'Peta Zona' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/keputusan', label: 'Keputusan' },
  { href: '/foto', label: 'Foto Progres' },
  { href: '/laporan-mingguan', label: 'Laporan Mingguan' },
] as const;

export function PortalNav({ projectId, active }: { projectId: string; active: (typeof TABS)[number]['href'] }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-3 text-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={`/portal/${projectId}${tab.href}` as Route}
          className={`rounded-md px-3 py-1.5 font-medium ${
            tab.href === active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
