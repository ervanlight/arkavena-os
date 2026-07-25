'use client';

import { useActionState } from 'react';
import { createProposalAction } from '@/modules/estimating';
import { Button } from '@/core/ui';

type FormState = { error: string | null };

export function CreateProposalForm({ projectId, estimateId }: { projectId: string; estimateId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await createProposalAction({ projectId, estimateId });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see NewLeadForm's own comment.
    window.location.href = `/cc/projects/${projectId}/proposals/${result.data.id}`;
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
        {isPending ? 'Membuat...' : 'Buat proposal dari estimasi ini'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
