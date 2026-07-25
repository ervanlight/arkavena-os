'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { markFundingReceiptClearedAction } from '@/modules/cash-gate';
import { Button } from '@/core/ui';

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
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Menandai...' : 'Tandai cair'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
