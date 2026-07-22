'use client';

import { useActionState } from 'react';
import { createMaterialRequestAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

export function MaterialRequestForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const neededByDate = String(formData.get('neededByDate') ?? '').trim();

    const result = await submitOrQueueOffline(
      'material_request',
      {
        id: crypto.randomUUID(),
        projectId,
        itemDescription: String(formData.get('itemDescription') ?? '').trim(),
        quantity: Number(formData.get('quantity')),
        unit: String(formData.get('unit') ?? '').trim(),
        neededByDate: neededByDate === '' ? undefined : neededByDate,
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      },
      createMaterialRequestAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Permintaan material terkirim.' };
  }, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="itemDescription" className="block text-sm font-medium text-slate-700">
          Nama material
        </label>
        <input
          id="itemDescription"
          name="itemDescription"
          required
          placeholder="mis. Semen 50kg"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
            Jumlah
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label htmlFor="unit" className="block text-sm font-medium text-slate-700">
            Satuan
          </label>
          <input
            id="unit"
            name="unit"
            required
            placeholder="mis. sak, kubik"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="neededByDate" className="block text-sm font-medium text-slate-700">
          Dibutuhkan sebelum
        </label>
        <input
          id="neededByDate"
          name="neededByDate"
          type="date"
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
        {isPending ? 'Mengirim...' : 'Kirim Permintaan'}
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
