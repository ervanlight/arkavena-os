'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createHoldPointTemplateAction } from '@/modules/quality-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CreateHoldPointTemplateForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createHoldPointTemplateAction({
      workType: String(formData.get('workType') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
    });

    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="workType" className="block text-xs font-medium text-slate-700">
          Jenis pekerjaan
        </label>
        <input
          id="workType"
          name="workType"
          required
          placeholder="mis. waterproofing"
          className="mt-1 w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="hptName" className="block text-xs font-medium text-slate-700">
          Nama hold point
        </label>
        <input
          id="hptName"
          name="name"
          required
          placeholder="mis. Flood test"
          className="mt-1 w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="hptDescription" className="block text-xs font-medium text-slate-700">
          Keterangan
        </label>
        <input
          id="hptDescription"
          name="description"
          placeholder="opsional"
          className="mt-1 w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Tambah'}
      </button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
