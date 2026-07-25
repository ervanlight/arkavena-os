'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { completeAssessmentAction } from '@/modules/assessment';
import { Button } from '@/core/ui';

type FormState = { error: string | null };

export function CompleteAssessmentForm({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await completeAssessmentAction({ id: assessmentId });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-[color:var(--color-ink-secondary)]">
        Menandai assessment ini selesai, dengan Anda sebagai penilai dan waktu saat ini.
      </p>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Tandai selesai'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
