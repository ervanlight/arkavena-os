'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimateItemAction } from '@/modules/estimating';
import { Button, Input, Label } from '@/core/ui';

type FormState = { error: string | null };

export function AddItemForm({ estimateId }: { estimateId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createEstimateItemAction({
      estimateId,
      description: String(formData.get('description') ?? ''),
      unit: String(formData.get('unit') ?? ''),
      quantity: Number(formData.get('quantity') ?? 0),
      unitCost: String(formData.get('unitCost') ?? ''),
      unitPrice: String(formData.get('unitPrice') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor="description">Deskripsi *</Label>
        <Input id="description" name="description" required />
      </div>
      <div>
        <Label htmlFor="unit">Satuan *</Label>
        <Input id="unit" name="unit" required />
      </div>
      <div>
        <Label htmlFor="quantity">Kuantitas *</Label>
        <Input id="quantity" name="quantity" type="number" step="any" required />
      </div>
      <div>
        <Label htmlFor="unitCost">Biaya satuan (Rp) *</Label>
        <Input id="unitCost" name="unitCost" required inputMode="numeric" />
      </div>
      <div>
        <Label htmlFor="unitPrice">Harga satuan (Rp) *</Label>
        <Input id="unitPrice" name="unitPrice" required inputMode="numeric" />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menambahkan...' : 'Tambah item'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
