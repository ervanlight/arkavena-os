'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { submitChangeOrderForReviewAction } from '@/modules/scope-variation';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function SubmitForReviewForm({ changeOrderId }: { changeOrderId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await submitChangeOrderForReviewAction(changeOrderId);
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Mengirim...' : 'Ajukan untuk direview'}
      </button>
      {state.error !== null && (
        <span role="alert" className="text-sm text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
