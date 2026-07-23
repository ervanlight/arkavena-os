'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createCostLibraryItemAction } from '@/modules/estimating';

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
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Nama item *
        </label>
        <input
          id="name"
          name="name"
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
          placeholder="m2, m3, sak, ..."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="defaultUnitCost" className="block text-sm font-medium text-slate-700">
          Harga satuan (Rp) *
        </label>
        <input
          id="defaultUnitCost"
          name="defaultUnitCost"
          required
          inputMode="numeric"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          Kategori
        </label>
        <input
          id="category"
          name="category"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan item'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
