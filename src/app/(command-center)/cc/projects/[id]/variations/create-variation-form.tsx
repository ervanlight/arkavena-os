'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createChangeOrderAction } from '@/modules/scope-variation';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CreateVariationForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createChangeOrderAction({
      projectId,
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.push(`/cc/projects/${projectId}/variations/${result.data.id}`);
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="variationTitle" className="block text-xs font-medium text-slate-700">
          Judul
        </label>
        <input
          id="variationTitle"
          name="title"
          required
          placeholder="mis. Tambah kamar mandi lantai 2"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="variationDescription" className="block text-xs font-medium text-slate-700">
          Keterangan
        </label>
        <textarea
          id="variationDescription"
          name="description"
          rows={2}
          placeholder="Detail permintaan perubahan dari klien"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Buat draft variation'}
      </button>
      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
