'use client';

import React, { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@/core/ui';
import { formatRp, toRupiah } from '@/core/money/rupiah';
import { approveVendorRabAction, rejectVendorRabAction } from '@/modules/partner-rab';

export function AdminRabReviewClient({ quote }: { quote: any }) {
  const router = useRouter();

  const [, approveAction, isApproving] = useActionState(async (_prev: any, _formData: FormData) => {
    const result = await approveVendorRabAction({ quoteId: quote.id, projectId: quote.project_id });
    if (!result.ok) {
      alert('Gagal menyetujui: ' + result.error.message);
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const [, rejectAction, isRejecting] = useActionState(async (_prev: any, _formData: FormData) => {
    const result = await rejectVendorRabAction({ quoteId: quote.id });
    if (!result.ok) {
      alert('Gagal menolak');
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const items = quote.vendor_quote_items || [];
  const grandTotal = quote.amount;

  const groupedItems = items.reduce((acc: any, item: any) => {
    const group = item.group_name || 'Lain-lain';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  return (
    <Card className="border-[color:var(--color-primary-light)]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-md font-semibold text-[color:var(--color-ink)]">{quote.description}</h3>
          <p className="text-sm text-[color:var(--color-ink-secondary)]">
            Disubmit pada {new Date(quote.created_at).toLocaleDateString('id-ID')}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={rejectAction}>
            <Button type="submit" variant="destructive" disabled={isApproving || isRejecting}>
              Tolak & Kembalikan
            </Button>
          </form>
          <form action={approveAction}>
            <Button type="submit" variant="primary" disabled={isApproving || isRejecting}>
              Setujui & Jadikan RAB Proyek
            </Button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[color:var(--color-hairline)]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-hairline)]">
            <tr>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">Uraian Pekerjaan</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-right">Volume</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">Sat.</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-right">Harga Satuan (HPP)</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-right">Jumlah HPP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-hairline)]">
            {Object.entries(groupedItems).map(([group, groupItems]: [string, any]) => {
              const groupTotal = groupItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);
              return (
                <React.Fragment key={group}>
                  <tr className="bg-[color:var(--color-primary-light)]/10">
                    <td colSpan={4} className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">{group}</td>
                    <td className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-right">{formatRp(toRupiah(groupTotal))}</td>
                  </tr>
                  {groupItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[color:var(--color-surface-sunken)]">
                      <td className="px-4 py-2 text-[color:var(--color-ink)] pl-8">{item.description}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">{Number(item.quantity).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2 text-[color:var(--color-ink)]">{item.unit}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">{formatRp(toRupiah(item.unit_cost))}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">
                        {formatRp(toRupiah(Number(item.quantity) * Number(item.unit_cost)))}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            <tr className="bg-[color:var(--color-surface-sunken)] border-t-2 border-t-[color:var(--color-primary)]">
              <td colSpan={4} className="px-4 py-3 font-bold text-[color:var(--color-ink)] text-right">JUMLAH HPP</td>
              <td className="px-4 py-3 font-bold text-[color:var(--color-primary)] text-right">{formatRp(toRupiah(grandTotal))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
