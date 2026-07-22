'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelInvoiceAction } from '@/modules/billing';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CancelInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const reason = String(formData.get('reason') ?? '');
    const result = await cancelInvoiceAction({ id: invoiceId, reason });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input
        name="reason"
        required
        placeholder="Alasan pembatalan"
        className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? 'Membatalkan...' : 'Batalkan'}
      </button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
