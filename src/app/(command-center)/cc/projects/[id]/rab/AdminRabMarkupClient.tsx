'use client';

import React, { useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@/core/ui';
import { formatRp, toRupiah } from '@/core/money/rupiah';
import { updateRabMarkupAction, applyGlobalMarkupAction, submitRabToClientAction } from '@/modules/partner-rab';

export function AdminRabMarkupClient({ estimate }: { estimate: any }) {
  const router = useRouter();
  const items = estimate.estimate_items || [];
  const [globalMarkup, setGlobalMarkup] = useState<number>(0);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  const [, updatePriceAction, isUpdatingPrice] = useActionState(async (_prev: any, formData: FormData) => {
    const itemId = formData.get('itemId') as string;
    const unitPrice = Number(formData.get('unitPrice'));
    const result = await updateRabMarkupAction({ itemId, unitPrice });
    if (!result.ok) {
      alert('Gagal memperbarui harga');
      return { ok: false };
    }
    setEditingItem(null);
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const [, applyGlobalAction, isApplyingGlobal] = useActionState(async (_prev: any, formData: FormData) => {
    const percentage = Number(formData.get('percentage'));
    const result = await applyGlobalMarkupAction({ estimateId: estimate.id, percentage });
    if (!result.ok) {
      alert('Gagal menerapkan markup global');
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const [, submitToClientAction, isSubmitting] = useActionState(async (_prev: any, _formData: FormData) => {
    const result = await submitRabToClientAction({ estimateId: estimate.id, projectId: estimate.project_id });
    if (!result.ok) {
      alert('Gagal mengirim ke klien');
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const groupedItems = items.reduce((acc: any, item: any) => {
    const group = item.group_name || 'Lain-lain';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const grandTotalHPP = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);
  const grandTotalJual = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);
  const totalMargin = grandTotalJual - grandTotalHPP;
  const marginPercent = grandTotalHPP > 0 ? (totalMargin / grandTotalHPP) * 100 : 0;

  return (
    <div className="space-y-6">
      <form action={applyGlobalAction} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[color:var(--color-primary-light)]/10 p-4 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="percentage">Markup Global (%)</Label>
            <Input 
              type="number" 
              id="percentage"
              name="percentage"
              value={globalMarkup.toString()} 
              onChange={(e) => setGlobalMarkup(Number(e.target.value))} 
              className="w-32"
            />
          </div>
          <Button 
            type="submit"
            variant="secondary" 
            className="mt-6"
            disabled={isApplyingGlobal}
          >
            Terapkan ke Semua
          </Button>
        </div>
        <div className="text-right">
          <p className="text-sm text-[color:var(--color-ink-secondary)]">Proyeksi Margin</p>
          <p className="text-lg font-bold text-[color:var(--color-success)]">
            {formatRp(toRupiah(totalMargin))} ({marginPercent.toFixed(1)}%)
          </p>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-[color:var(--color-hairline)]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-hairline)]">
            <tr>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">Uraian Pekerjaan</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-right">Volume</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">Sat.</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink-secondary)] text-right border-l border-[color:var(--color-hairline)]">HPP Satuan</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink-secondary)] text-right">Total HPP</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-primary)] text-right border-l border-[color:var(--color-hairline)]">Harga Jual Satuan</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-primary)] text-right">Total Jual</th>
              <th className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-center w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-hairline)]">
            {Object.entries(groupedItems).map(([group, groupItems]: [string, any]) => {
              const groupTotalHPP = groupItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);
              const groupTotalJual = groupItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);
              return (
                <React.Fragment key={group}>
                  <tr className="bg-[color:var(--color-primary-light)]/10">
                    <td colSpan={3} className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">{group}</td>
                    <td colSpan={2} className="px-4 py-2 font-semibold text-[color:var(--color-ink-secondary)] text-right border-l border-[color:var(--color-hairline)]">{formatRp(toRupiah(groupTotalHPP))}</td>
                    <td colSpan={2} className="px-4 py-2 font-semibold text-[color:var(--color-primary)] text-right border-l border-[color:var(--color-hairline)]">{formatRp(toRupiah(groupTotalJual))}</td>
                    <td></td>
                  </tr>
                  {groupItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[color:var(--color-surface-sunken)]">
                      <td className="px-4 py-2 text-[color:var(--color-ink)] pl-8">{item.description}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">{Number(item.quantity).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2 text-[color:var(--color-ink)]">{item.unit}</td>
                      
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink-secondary)] border-l border-[color:var(--color-hairline)]">{formatRp(toRupiah(item.unit_cost))}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink-secondary)]">{formatRp(toRupiah(Number(item.quantity) * Number(item.unit_cost)))}</td>
                      
                      <td className="px-4 py-2 text-right font-medium text-[color:var(--color-primary)] border-l border-[color:var(--color-hairline)]">
                        {editingItem === item.id ? (
                          <form id={`form-${item.id}`} action={updatePriceAction}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <input 
                              type="number" 
                              name="unitPrice"
                              className="w-full text-right bg-white border border-[color:var(--color-primary)] rounded px-2 py-1 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                              value={editPrice}
                              onChange={(e) => setEditPrice(Number(e.target.value))}
                              autoFocus
                            />
                          </form>
                        ) : (
                          formatRp(toRupiah(item.unit_price))
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-[color:var(--color-primary)]">
                        {formatRp(toRupiah(Number(item.quantity) * (editingItem === item.id ? editPrice : Number(item.unit_price))))}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {editingItem === item.id ? (
                          <div className="flex justify-center gap-2">
                            <button type="submit" form={`form-${item.id}`} disabled={isUpdatingPrice} className="text-[color:var(--color-success)] text-xs font-semibold hover:underline">Simpan</button>
                            <button onClick={() => setEditingItem(null)} className="text-[color:var(--color-ink-secondary)] text-xs hover:underline">Batal</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingItem(item.id); setEditPrice(Number(item.unit_price)); }} className="text-[color:var(--color-primary)] text-xs font-semibold hover:underline">
                            Edit Jual
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            <tr className="bg-[color:var(--color-surface-sunken)] border-t-2 border-t-[color:var(--color-primary)]">
              <td colSpan={3} className="px-4 py-3 font-bold text-[color:var(--color-ink)] text-right">JUMLAH TOTAL</td>
              <td colSpan={2} className="px-4 py-3 font-bold text-[color:var(--color-ink-secondary)] text-right border-l border-[color:var(--color-hairline)]">{formatRp(toRupiah(grandTotalHPP))}</td>
              <td colSpan={2} className="px-4 py-3 font-bold text-[color:var(--color-primary)] text-right text-base border-l border-[color:var(--color-hairline)]">{formatRp(toRupiah(grandTotalJual))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-4">
        {estimate.status === 'draft' ? (
          <form action={submitToClientAction}>
            <Button 
              type="submit"
              disabled={isSubmitting} 
              className="w-full md:w-auto"
            >
              Selesai Markup & Kirim ke Klien
            </Button>
          </form>
        ) : (
          <div className="px-4 py-2 bg-[color:var(--color-success)]/10 text-[color:var(--color-success)] rounded-full text-sm font-semibold">Telah Dikirim ke Klien</div>
        )}
      </div>
    </div>
  );
}
