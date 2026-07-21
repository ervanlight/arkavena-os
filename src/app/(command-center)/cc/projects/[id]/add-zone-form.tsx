'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createZoneAction } from '@/modules/projects';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function AddZoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createZoneAction({
      projectId,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="zoneName" className="block text-xs font-medium text-slate-700">
          Nama zona
        </label>
        <input
          id="zoneName"
          name="name"
          required
          placeholder="mis. Lantai 1"
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="zoneDescription" className="block text-xs font-medium text-slate-700">
          Keterangan
        </label>
        <input
          id="zoneDescription"
          name="description"
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menambah...' : 'Tambah zona'}
      </button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
