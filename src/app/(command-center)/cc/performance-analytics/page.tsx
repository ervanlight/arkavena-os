import { notFound } from 'next/navigation';
import { listVendorPerformanceAction } from '@/modules/performance-analytics';
import { PerformanceTable } from './_components/performance-table';
import { Button } from '@/core/ui';
import { Download, TrendingUp } from 'lucide-react';
import { formatRp, sumRp } from '@/core/money/rupiah';

export const metadata = { title: 'Performance Analytics — Arkavena OS' };

export default async function PerformanceAnalyticsPage() {
  const result = await listVendorPerformanceAction(undefined);

  if (!result.ok) {
    if (result.error.code === 'PERMISSION_DENIED') notFound();
    return (
      <div className="p-6">
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      </div>
    );
  }

  const data = result.data;

  // Calculate high-level summary
  const totalContractValue = sumRp(data.map((v) => v.totalContractValue));
  const totalVendors = data.length;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)] flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            Performance Analytics
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">
            Dasbor evaluasi keandalan dan finansial Subkontraktor & Supplier
          </p>
        </div>
        <Button variant="secondary" className="gap-2">
          <Download size={16} />
          Unduh Laporan CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--color-hairline)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--color-ink-secondary)]">Total Mitra Aktif</p>
          <p className="mt-2 text-3xl font-bold text-[color:var(--color-ink)]">{totalVendors}</p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-hairline)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--color-ink-secondary)]">Total Nilai Kontrak (PO)</p>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-ink)]">
            {formatRp(totalContractValue)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-hairline)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--color-ink-secondary)]">Rata-rata Konversi Kutipan</p>
          <p className="mt-2 text-3xl font-bold text-[color:var(--color-success)]">
            {totalVendors > 0 
              ? (data.reduce((sum, v) => sum + v.quoteConversionRate, 0) / totalVendors).toFixed(1) 
              : 0}%
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[color:var(--color-ink)] mb-4">Papan Peringkat Vendor</h2>
        <PerformanceTable data={data} />
      </div>
    </div>
  );
}
