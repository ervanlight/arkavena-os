'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { overrideIssuePurchaseOrderAction, type Vendor, type VendorQuote } from '@/modules/procurement';

type FormState = { error: string | null };

/**
 * The one path that issues a PO under a red/overdue Cash Gate (ADR 0010).
 * requirePermission (cash_gate_override.create -> owner only) is why this
 * page only renders the form for an owner; trg_cash_gate_overrides_guard_owner_only
 * is the real, unbypassable authority either way (CLAUDE.md 0.3).
 */
export function OverridePurchaseOrderForm({
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

    const result = await overrideIssuePurchaseOrderAction({
      projectId,
      vendorId: String(formData.get('vendorId') ?? ''),
      ...(vendorQuoteId !== '' ? { vendorQuoteId } : {}),
      description: String(formData.get('description') ?? ''),
      amount: String(formData.get('amount') ?? ''),
      reason: String(formData.get('reason') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="override-vendorId" className="block text-sm font-medium text-slate-700">
          Vendor *
        </label>
        <select
          id="override-vendorId"
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
        <label htmlFor="override-vendorQuoteId" className="block text-sm font-medium text-slate-700">
          Dari penawaran
        </label>
        <select
          id="override-vendorQuoteId"
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
        <label htmlFor="override-description" className="block text-sm font-medium text-slate-700">
          Deskripsi *
        </label>
        <input
          id="override-description"
          name="description"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="override-amount" className="block text-sm font-medium text-slate-700">
          Nominal (Rp) *
        </label>
        <input
          id="override-amount"
          name="amount"
          required
          inputMode="numeric"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div className="col-span-full">
        <label htmlFor="override-reason" className="block text-sm font-medium text-slate-700">
          Alasan override *
        </label>
        <textarea
          id="override-reason"
          name="reason"
          required
          rows={2}
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
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isPending ? 'Menerbitkan...' : 'Override dan terbitkan PO'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
