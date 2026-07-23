'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createHandoverItemAction } from '@/modules/maintenance-engine';

type FormState = { error: string | null };

export function CreateHandoverItemForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createHandoverItemAction({
      projectId,
      itemType: String(formData.get('itemType') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      handedOverTo: String(formData.get('handedOverTo') ?? '') || undefined,
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
        <label htmlFor="itemType" className="block text-sm font-medium text-slate-700">
          Jenis item *
        </label>
        <input
          id="itemType"
          name="itemType"
          required
          placeholder="key, as_built_drawing, ac_unit, ..."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Deskripsi
        </label>
        <input
          id="description"
          name="description"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="handedOverTo" className="block text-sm font-medium text-slate-700">
          Diserahkan kepada
        </label>
        <input
          id="handedOverTo"
          name="handedOverTo"
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
          {isPending ? 'Menyimpan...' : 'Tambah item handover'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
