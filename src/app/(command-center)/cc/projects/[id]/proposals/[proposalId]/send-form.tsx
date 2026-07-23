'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { sendProposalAction } from '@/modules/estimating';

type FormState = { error: string | null };

export function SendProposalForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await sendProposalAction({ id: proposalId });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
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
        {isPending ? 'Mengirim...' : 'Kirim proposal'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
