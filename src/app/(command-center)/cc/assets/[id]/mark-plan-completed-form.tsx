'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { markMaintenancePlanCompletedAction } from '@/modules/maintenance-engine';

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
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Tandai selesai hari ini'}
      </button>
      {state.error !== null && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
