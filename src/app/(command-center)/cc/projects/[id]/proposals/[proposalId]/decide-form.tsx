'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { decideProposalAction } from '@/modules/estimating';

type FormState = { error: string | null };

export function DecideProposalForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await decideProposalAction({
      id: proposalId,
      decision: String(formData.get('decision') ?? '') as 'accepted' | 'rejected',
      reason: String(formData.get('reason') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label htmlFor="decision" className="block text-sm font-medium text-slate-700">
          Keputusan *
        </label>
        <select
          id="decision"
          name="decision"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="accepted">Diterima</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
          Alasan *
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

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
        {isPending ? 'Menyimpan...' : 'Simpan keputusan'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
