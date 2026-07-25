'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { setBaselineEstimateAction } from '@/modules/estimating';
import { Button } from '@/core/ui';

type FormState = { error: string | null };

export function SetBaselineForm({ estimateId }: { estimateId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await setBaselineEstimateAction({ id: estimateId });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-[color:var(--color-ink-secondary)]">
        Menjadikan versi ini baseline proyek. Baseline sebelumnya (jika ada) otomatis dilepas
        (uq_estimates_one_baseline_per_project).
      </p>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Jadikan baseline'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
