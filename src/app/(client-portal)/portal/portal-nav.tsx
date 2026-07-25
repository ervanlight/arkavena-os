import type { Route } from 'next';
import Link from 'next/link';
import { Activity, BarChart2, ShieldCheck, Wallet } from 'lucide-react';

const TABS = [
  { href: '', label: 'Overview', icon: Activity },
  { href: '/progress', label: 'Progress', icon: BarChart2 },
  { href: '/quality', label: 'Quality', icon: ShieldCheck },
  { href: '/financial', label: 'Financial', icon: Wallet },
] as const;

export function PortalNav({ projectId, active }: { projectId: string; active: string }) {
  return (
    <nav className="flex gap-6 border-b border-white/10 mb-6">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={`/portal/${projectId}${tab.href}` as Route}
            className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 ${
              isActive
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
