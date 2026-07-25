import { BarChart3, Clock, TrendingUp, ShieldCheck } from 'lucide-react';
import { Card } from '@/core/ui';

export const metadata = { title: 'Performance Analytics — Arkavena OS' };

export default function PerformanceAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Performance Analytics</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Metrik operasional internal Arkavena OS (Communication Latency, Margin Tracking, &amp; Subcontractor SLA).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-ink-tertiary)] uppercase">
            <Clock size={16} className="text-blue-600" /> Communication Latency
          </div>
          <p className="text-2xl font-bold text-[color:var(--color-ink)]">42 Min</p>
          <p className="text-xs text-green-600">&darr; 15% dari minggu lalu</p>
        </Card>

        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-ink-tertiary)] uppercase">
            <TrendingUp size={16} className="text-green-600" /> Rata-rata Margin VO
          </div>
          <p className="text-2xl font-bold text-[color:var(--color-ink)]">18.5%</p>
          <p className="text-xs text-[color:var(--color-ink-tertiary)]">Target internal: &gt;= 15%</p>
        </Card>

        <Card className="border border-[color:var(--color-hairline)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-ink-tertiary)] uppercase">
            <ShieldCheck size={16} className="text-purple-600" /> Subcontractor SLA
          </div>
          <p className="text-2xl font-bold text-[color:var(--color-ink)]">96.2%</p>
          <p className="text-xs text-green-600">Laporan harian terverifikasi</p>
        </Card>
      </div>
    </div>
  );
}
