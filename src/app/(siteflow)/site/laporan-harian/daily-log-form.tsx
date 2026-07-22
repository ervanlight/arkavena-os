'use client';

import { useActionState } from 'react';
import { createDailyLogAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyLogForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const manpowerRaw = String(formData.get('manpowerCount') ?? '').trim();

    const result = await submitOrQueueOffline(
      'daily_log',
      {
        id: crypto.randomUUID(),
        projectId,
        logDate: String(formData.get('logDate') ?? today()),
        weather: String(formData.get('weather') ?? '').trim() || undefined,
        manpowerCount: manpowerRaw === '' ? undefined : Number(manpowerRaw),
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      },
      createDailyLogAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Laporan harian tersimpan.' };
  }, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="logDate" className="block text-sm font-medium text-slate-700">
          Tanggal
        </label>
        <input
          id="logDate"
          name="logDate"
          type="date"
          defaultValue={today()}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="weather" className="block text-sm font-medium text-slate-700">
          Cuaca
        </label>
        <input
          id="weather"
          name="weather"
          placeholder="mis. Cerah, Hujan siang"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="manpowerCount" className="block text-sm font-medium text-slate-700">
          Jumlah pekerja
        </label>
        <input
          id="manpowerCount"
          name="manpowerCount"
          type="number"
          min={0}
          inputMode="numeric"
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
        {isPending ? 'Menyimpan...' : 'Simpan Laporan'}
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
