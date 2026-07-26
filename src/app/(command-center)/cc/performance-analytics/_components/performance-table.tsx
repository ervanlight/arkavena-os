import { Card } from '@/core/ui';
import type { VendorPerformanceSummary } from '@/modules/performance-analytics';
import { MetricBadge } from './metric-badge';

import { formatRp } from '@/core/money/rupiah';

export function PerformanceTable({ data }: { data: VendorPerformanceSummary[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-canvas)] text-sm text-[color:var(--color-ink-tertiary)]">
        Belum ada data vendor atau subkontraktor di organisasi ini.
      </div>
    );
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[color:var(--color-ink)]">
          <thead className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] text-xs font-semibold text-[color:var(--color-ink-secondary)]">
            <tr>
              <th scope="col" className="px-6 py-4">Nama Vendor</th>
              <th scope="col" className="px-6 py-4">Total Kutipan (RAB)</th>
              <th scope="col" className="px-6 py-4">Rasio Konversi</th>
              <th scope="col" className="px-6 py-4 text-right">Nilai Kontrak (PO)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-hairline)] bg-white">
            {data.map((row) => (
              <tr key={row.vendorId} className="hover:bg-[color:var(--color-surface-secondary)]/50">
                <td className="px-6 py-4 font-medium">{row.vendorName}</td>
                <td className="px-6 py-4">
                  {row.totalQuotes} Kutipan <span className="text-xs text-[color:var(--color-ink-tertiary)]">({row.acceptedQuotes} disetujui)</span>
                </td>
                <td className="px-6 py-4">
                  <MetricBadge conversionRate={row.quoteConversionRate} />
                </td>
                <td className="px-6 py-4 text-right font-medium">
                  {formatRp(row.totalContractValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
