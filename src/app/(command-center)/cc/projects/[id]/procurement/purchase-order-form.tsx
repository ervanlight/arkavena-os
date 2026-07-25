'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createPurchaseOrderAction, type Vendor, type VendorQuote } from '@/modules/procurement';
import type { MaterialRequest } from '@/modules/field-reporting';
import { Button, Input, Label, Select } from '@/core/ui';

type FormState = { error: string | null };

/**
 * A plain INSERT (ADR 0018 SS6) -- trg_purchase_orders_guard_cash_gate rejects
 * it outright under a red/overdue gate, surfacing here as this form's error
 * message (ADR 0015). Use OverridePurchaseOrderForm to issue anyway.
 */
export function CreatePurchaseOrderForm({
  projectId,
  vendors,
  quotes,
  materialRequests,
}: {
  projectId: string;
  vendors: Vendor[];
  quotes: VendorQuote[];
  materialRequests: MaterialRequest[];
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const vendorQuoteId = String(formData.get('vendorQuoteId') ?? '');
    const materialRequestId = String(formData.get('materialRequestId') ?? '');

    const result = await createPurchaseOrderAction({
      projectId,
      vendorId: String(formData.get('vendorId') ?? ''),
      ...(vendorQuoteId !== '' ? { vendorQuoteId } : {}),
      ...(materialRequestId !== '' ? { materialRequestId } : {}),
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
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
        <Label htmlFor="vendorQuoteId">Dari penawaran</Label>
        <Select id="vendorQuoteId" name="vendorQuoteId">
          <option value="">-- Langsung, tanpa penawaran --</option>
          {quotes.map((quote) => (
            <option key={quote.id} value={quote.id}>
              {quote.description}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="materialRequestId">Memenuhi permintaan material</Label>
        <Select id="materialRequestId" name="materialRequestId">
          <option value="">-- Tidak terkait permintaan tertentu --</option>
          {materialRequests.map((request) => (
            <option key={request.id} value={request.id}>
              {request.item_description} ({request.quantity} {request.unit})
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
          {isPending ? 'Menerbitkan...' : 'Terbitkan PO'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
