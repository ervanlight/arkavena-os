'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createCostLibraryItemAction } from '@/modules/estimating';
import { Card, Input, Label, Button } from '@/core/ui';

type FormState = { error: string | null };

export function NewCostLibraryItemForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createCostLibraryItemAction({
      name: String(formData.get('name') ?? ''),
      unit: String(formData.get('unit') ?? ''),
      defaultUnitCost: String(formData.get('defaultUnitCost') ?? ''),
      category: String(formData.get('category') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.push('/cc/cost-library');
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name">Nama item *</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="unit">Satuan *</Label>
          <Input id="unit" name="unit" required placeholder="m2, m3, sak, ..." />
        </div>
        <div>
          <Label htmlFor="defaultUnitCost">Harga satuan (Rp) *</Label>
          <Input id="defaultUnitCost" name="defaultUnitCost" required inputMode="numeric" />
        </div>
        <div>
          <Label htmlFor="category">Kategori</Label>
          <Input id="category" name="category" />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan item'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
