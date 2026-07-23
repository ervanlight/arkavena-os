'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createMaintenancePlanAction } from '@/modules/maintenance-engine';

type FormState = { error: string | null };

export function CreateMaintenancePlanForm({ assetId }: { assetId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createMaintenancePlanAction({
      assetId,
      title: String(formData.get('title') ?? ''),
      intervalDays: Number(formData.get('intervalDays') ?? 0),
      startsAt: String(formData.get('startsAt') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <label htmlFor="planTitle" className="block text-sm font-medium text-slate-700">
          Judul jadwal *
        </label>
        <input
          id="planTitle"
          name="title"
          required
          placeholder="Servis rutin AC"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="intervalDays" className="block text-sm font-medium text-slate-700">
          Interval (hari) *
        </label>
        <input
          id="intervalDays"
          name="intervalDays"
          type="number"
          min={1}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="startsAt" className="block text-sm font-medium text-slate-700">
          Mulai *
        </label>
        <input
          id="startsAt"
          name="startsAt"
          type="date"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : 'Tambah jadwal perawatan'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
