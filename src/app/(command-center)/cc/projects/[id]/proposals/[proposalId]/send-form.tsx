'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { sendProposalAction } from '@/modules/estimating';
import { Button } from '@/core/ui';

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
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Mengirim...' : 'Kirim proposal'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
