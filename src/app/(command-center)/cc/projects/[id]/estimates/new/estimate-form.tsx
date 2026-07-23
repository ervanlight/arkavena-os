'use client';

import { useActionState } from 'react';
import { createEstimateAction } from '@/modules/estimating';

type FormState = { error: string | null };

export function NewEstimateForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createEstimateAction({
      projectId,
      title: String(formData.get('title') ?? ''),
      notes: String(formData.get('notes') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see NewLeadForm's own comment.
    window.location.href = `/cc/projects/${projectId}/estimates/${result.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Judul *
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="Estimasi awal"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Catatan
        </label>
        <textarea
          id="notes"
          name="notes"
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
        {isPending ? 'Menyimpan...' : 'Buat estimasi'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
