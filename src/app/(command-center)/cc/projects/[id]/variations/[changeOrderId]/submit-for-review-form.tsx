'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { submitChangeOrderForReviewAction } from '@/modules/variations';
import { Button } from '@/core/ui';

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
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Mengirim...' : 'Ajukan untuk direview'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
