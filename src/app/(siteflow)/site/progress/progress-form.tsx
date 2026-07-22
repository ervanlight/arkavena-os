'use client';

import { useActionState } from 'react';
import { createProgressEntryAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';

type WorkPackage = { id: string; name: string };

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

export function ProgressForm({
  projectId,
  dailyLogId,
  workPackages,
}: {
  projectId: string;
  dailyLogId: string;
  workPackages: WorkPackage[];
}) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const result = await submitOrQueueOffline(
      'progress_entry',
      {
        id: crypto.randomUUID(),
        projectId,
        dailyLogId,
        workPackageId: String(formData.get('workPackageId')),
        progressPercent: Number(formData.get('progressPercent')),
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      },
      createProgressEntryAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Progress tersimpan.' };
  }, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="workPackageId" className="block text-sm font-medium text-slate-700">
          Paket kerja
        </label>
        <select
          id="workPackageId"
          name="workPackageId"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {workPackages.map((wp) => (
            <option key={wp.id} value={wp.id}>
              {wp.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="progressPercent" className="block text-sm font-medium text-slate-700">
          Progress (%)
        </label>
        <input
          id="progressPercent"
          name="progressPercent"
          type="number"
          min={0}
          max={100}
          inputMode="numeric"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
          placeholder="Catatan tambahan (opsional)"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-3 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan Progress'}
      </button>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === 'offline' && <p className="text-sm text-amber-600">{state.message}</p>}
      {state.status === 'ok' && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
