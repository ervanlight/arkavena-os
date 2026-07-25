'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { markMaintenancePlanCompletedAction } from '@/modules/maintenance-engine';
import { Button } from '@/core/ui';

type FormState = { error: string | null };

export function MarkPlanCompletedForm({ planId }: { planId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await markMaintenancePlanCompletedAction({ id: planId });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Tandai selesai hari ini'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="mt-1 text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
