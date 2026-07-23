'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimateItemAction } from '@/modules/estimating';

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
        <label htmlFor="unit" className="block text-sm font-medium text-slate-700">
          Satuan *
        </label>
        <input
          id="unit"
          name="unit"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
          Kuantitas *
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          step="any"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="unitCost" className="block text-sm font-medium text-slate-700">
          Biaya satuan (Rp) *
        </label>
        <input
          id="unitCost"
          name="unitCost"
          required
          inputMode="numeric"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="unitPrice" className="block text-sm font-medium text-slate-700">
          Harga satuan (Rp) *
        </label>
        <input
          id="unitPrice"
          name="unitPrice"
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
          {isPending ? 'Menambahkan...' : 'Tambah item'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
