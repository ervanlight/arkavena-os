'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { markFundingReceiptClearedAction } from '@/modules/cash-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/** Finance's manual confirmation that a termin has actually cleared (owner decision D5). */
export function MarkClearedForm({ fundingReceiptId }: { fundingReceiptId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await markFundingReceiptClearedAction({ id: fundingReceiptId });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? 'Menandai...' : 'Tandai cair'}
      </button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
