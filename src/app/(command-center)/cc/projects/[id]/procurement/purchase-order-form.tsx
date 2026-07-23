'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createPurchaseOrderAction, type Vendor, type VendorQuote } from '@/modules/procurement';

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
}: {
  projectId: string;
  vendors: Vendor[];
  quotes: VendorQuote[];
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const vendorQuoteId = String(formData.get('vendorQuoteId') ?? '');

    const result = await createPurchaseOrderAction({
      projectId,
      vendorId: String(formData.get('vendorId') ?? ''),
      ...(vendorQuoteId !== '' ? { vendorQuoteId } : {}),
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
        <label htmlFor="vendorId" className="block text-sm font-medium text-slate-700">
          Vendor *
        </label>
        <select
          id="vendorId"
          name="vendorId"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">-- Pilih vendor --</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="vendorQuoteId" className="block text-sm font-medium text-slate-700">
          Dari penawaran
        </label>
        <select
          id="vendorQuoteId"
          name="vendorQuoteId"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">-- Langsung, tanpa penawaran --</option>
          {quotes.map((quote) => (
            <option key={quote.id} value={quote.id}>
              {quote.description}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Deskripsi *
        </label>
        <input
          id="description"
          name="description"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
          Nominal (Rp) *
        </label>
        <input
          id="amount"
          name="amount"
          required
          inputMode="numeric"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Menerbitkan...' : 'Terbitkan PO'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
