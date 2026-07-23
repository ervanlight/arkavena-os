'use client';

import { useActionState } from 'react';
import { createProposalAction } from '@/modules/estimating';

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
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Membuat...' : 'Buat proposal dari estimasi ini'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
