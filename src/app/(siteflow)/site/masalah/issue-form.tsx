'use client';

import { useActionState } from 'react';
import { createIssueAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

export function IssueForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const result = await submitOrQueueOffline(
      'issue',
      {
        id: crypto.randomUUID(),
        projectId,
        title: String(formData.get('title') ?? '').trim(),
        description: String(formData.get('description') ?? '').trim() || undefined,
        severity: String(formData.get('severity') ?? 'medium') as 'low' | 'medium' | 'high',
      },
      createIssueAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Masalah dilaporkan.' };
  }, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Judul masalah
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="mis. Retak dinding lantai 2"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="severity" className="block text-sm font-medium text-slate-700">
          Tingkat keparahan
        </label>
        <select
          id="severity"
          name="severity"
          defaultValue="medium"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="low">Ringan</option>
          <option value="medium">Sedang</option>
          <option value="high">Berat</option>
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Keterangan
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Jelaskan masalahnya (opsional)"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-3 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Mengirim...' : 'Lapor Masalah'}
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
