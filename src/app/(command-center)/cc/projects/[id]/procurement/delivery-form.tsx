'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeliveryAction } from '@/modules/procurement';

type FormState = { error: string | null };

export function CreateDeliveryForm({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createDeliveryAction({
      purchaseOrderId,
      notes: String(formData.get('notes') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor={`notes-${purchaseOrderId}`} className="block text-xs font-medium text-slate-700">
          Catatan pengiriman
        </label>
        <input
          id={`notes-${purchaseOrderId}`}
          name="notes"
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? 'Mencatat...' : 'Catat pengiriman'}
      </button>
      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
