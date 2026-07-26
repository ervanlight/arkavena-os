'use client';

import React, { useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { saveVendorRabItemAction, deleteVendorRabItemAction } from '@/modules/partner-rab';
import type { VendorQuoteItem } from '@/modules/partner-rab';
import { Button, Input, Label } from '@/core/ui';
import { formatRp, toRupiah } from '@/core/money/rupiah';
import { PlusIcon, TrashIcon } from 'lucide-react';

interface RabBuilderClientProps {
  quoteId: string;
  initialItems: VendorQuoteItem[];
}

export function RabBuilderClient({ quoteId, initialItems }: RabBuilderClientProps) {
  const router = useRouter();


  const [newItem, setNewItem] = useState({
    group_name: '',
    description: '',
    quantity: 1,
    unit: 'ls',
    unit_cost: 0,
  });

  const [, saveAction, isSaving] = useActionState(async (_prev: any, _formData: FormData) => {
    const result = await saveVendorRabItemAction({
      vendor_quote_id: quoteId,
      group_name: newItem.group_name,
      description: newItem.description,
      quantity: Number(newItem.quantity),
      unit: newItem.unit,
      unit_cost: Number(newItem.unit_cost),
    });
    
    if (!result.ok) {
      alert('Gagal menyimpan: ' + result.error.message);
      return { ok: false };
    }
    
    setNewItem({ ...newItem, description: '', quantity: 1, unit_cost: 0 });
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const [, deleteAction, isDeleting] = useActionState(async (_prev: any, formData: FormData) => {
    const id = formData.get('id') as string;
    const result = await deleteVendorRabItemAction({ id, quoteId });
    if (!result.ok) {
      alert('Gagal menghapus');
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const groupedItems = initialItems.reduce((acc, item) => {
    const group = item.group_name || 'Lain-lain';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, VendorQuoteItem[]>);

  const grandTotal = initialItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);

  return (
    <div className="space-y-6">
      
      <div className="overflow-x-auto rounded-lg border border-[color:var(--color-hairline)]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-hairline)]">
            <tr>
              <th className="px-4 py-3 font-semibold text-[color:var(--color-ink)] w-12">No.</th>
              <th className="px-4 py-3 font-semibold text-[color:var(--color-ink)] min-w-[250px]">Uraian Pekerjaan</th>
              <th className="px-4 py-3 font-semibold text-[color:var(--color-ink)] text-right w-24">Volume</th>
              <th className="px-4 py-3 font-semibold text-[color:var(--color-ink)] w-20">Sat.</th>
              <th className="px-4 py-3 font-semibold text-[color:var(--color-ink)] text-right w-36">Harga Satuan (Rp)</th>
              <th className="px-4 py-3 font-semibold text-[color:var(--color-ink)] text-right w-40">Jumlah (Rp)</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-hairline)]">
            {Object.keys(groupedItems).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[color:var(--color-ink-secondary)]">
                  RAB masih kosong. Tambahkan item di bawah.
                </td>
              </tr>
            )}

            {Object.entries(groupedItems).map(([group, groupItems], groupIdx) => {
              const groupTotal = groupItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);
              return (
                <React.Fragment key={group}>
                  <tr className="bg-[color:var(--color-primary-light)]/10">
                    <td className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">{groupIdx + 1}</td>
                    <td colSpan={4} className="px-4 py-2 font-semibold text-[color:var(--color-ink)]">{group}</td>
                    <td className="px-4 py-2 font-semibold text-[color:var(--color-ink)] text-right">{formatRp(toRupiah(groupTotal))}</td>
                    <td></td>
                  </tr>
                  
                  {groupItems.map((item, itemIdx) => (
                    <tr key={item.id} className="hover:bg-[color:var(--color-surface-sunken)] transition-colors">
                      <td className="px-4 py-2 text-[color:var(--color-ink-secondary)]">{groupIdx + 1}.{itemIdx + 1}</td>
                      <td className="px-4 py-2 text-[color:var(--color-ink)]">{item.description}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">{Number(item.quantity).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2 text-[color:var(--color-ink)]">{item.unit}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">{formatRp(toRupiah(item.unit_cost))}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-ink)]">
                        {formatRp(toRupiah(Number(item.quantity) * Number(item.unit_cost)))}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button 
                            type="submit"
                            disabled={isDeleting}
                            onClick={(e) => {
                              if(!confirm('Hapus item ini?')) e.preventDefault();
                            }}
                            className="text-[color:var(--color-danger)] p-1 rounded hover:bg-[color:var(--color-danger)]/10"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}

            <tr className="bg-[color:var(--color-surface-sunken)] border-t-2 border-t-[color:var(--color-primary)]">
              <td colSpan={5} className="px-4 py-3 font-bold text-[color:var(--color-ink)] text-right">JUMLAH TOTAL</td>
              <td className="px-4 py-3 font-bold text-[color:var(--color-primary)] text-right text-base">{formatRp(toRupiah(grandTotal))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <form action={saveAction} className="bg-[color:var(--color-surface-sunken)] p-4 rounded-lg border border-[color:var(--color-hairline)] space-y-4">
        <h3 className="font-semibold text-[color:var(--color-ink)] flex items-center gap-2">
          <PlusIcon className="w-5 h-5 text-[color:var(--color-primary)]" />
          Tambah Baris Pekerjaan
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="group_name">Kategori / Grup</Label>
              <Input 
                id="group_name"
                name="group_name"
                placeholder="Contoh: Pekerjaan Persiapan" 
                value={newItem.group_name} 
                onChange={(e) => setNewItem({...newItem, group_name: e.target.value})} 
              />
            </div>
          </div>
          <div className="md:col-span-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="description">Uraian Pekerjaan</Label>
              <Input 
                id="description"
                name="description"
                placeholder="Contoh: Pembersihan Lahan" 
                value={newItem.description} 
                onChange={(e) => setNewItem({...newItem, description: e.target.value})} 
              />
            </div>
          </div>
          
          <div className="md:col-span-1">
            <div className="flex flex-col gap-1">
              <Label htmlFor="quantity">Volume</Label>
              <Input 
                id="quantity"
                name="quantity"
                type="number"
                min="0"
                step="any"
                value={newItem.quantity.toString()} 
                onChange={(e) => setNewItem({...newItem, quantity: Number(e.target.value)})} 
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit">Satuan</Label>
              <Input 
                id="unit"
                name="unit"
                placeholder="m2, m3, ls" 
                value={newItem.unit} 
                onChange={(e) => setNewItem({...newItem, unit: e.target.value})} 
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit_cost">Harga Satuan (Rp)</Label>
              <Input 
                id="unit_cost"
                name="unit_cost"
                type="number"
                min="0"
                value={newItem.unit_cost.toString()} 
                onChange={(e) => setNewItem({...newItem, unit_cost: Number(e.target.value)})} 
              />
            </div>
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button 
              type="submit"
              className="w-full" 
              disabled={isSaving || !newItem.description || newItem.unit_cost < 0 || newItem.quantity <= 0}
            >
              Simpan Baris
            </Button>
          </div>
        </div>
      </form>

    </div>
  );
}
