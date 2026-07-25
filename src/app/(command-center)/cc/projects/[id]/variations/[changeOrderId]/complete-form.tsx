'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { completeChangeOrderAction } from '@/modules/scope-variation';
import { Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CompleteForm({ changeOrderId }: { changeOrderId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await completeChangeOrderAction(changeOrderId);
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menandai...' : 'Tandai variation selesai dikerjakan'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
