'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createVendorQuoteAction, type Vendor } from '@/modules/procurement';
import { Button, Input, Label, Select } from '@/core/ui';

type FormState = { error: string | null };

export function CreateVendorQuoteForm({ projectId, vendors }: { projectId: string; vendors: Vendor[] }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createVendorQuoteAction({
      projectId,
      vendorId: String(formData.get('vendorId') ?? ''),
      description: String(formData.get('description') ?? ''),
      amount: String(formData.get('amount') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="vendorId">Vendor *</Label>
        <Select id="vendorId" name="vendorId" required>
          <option value="">-- Pilih vendor --</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="description">Deskripsi *</Label>
        <Input id="description" name="description" required />
      </div>
      <div>
        <Label htmlFor="amount">Nominal (Rp) *</Label>
        <Input id="amount" name="amount" required inputMode="numeric" />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Tambah penawaran'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
