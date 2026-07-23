'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createVendorQuoteAction, type Vendor } from '@/modules/procurement';

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
          {isPending ? 'Menyimpan...' : 'Tambah penawaran'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
