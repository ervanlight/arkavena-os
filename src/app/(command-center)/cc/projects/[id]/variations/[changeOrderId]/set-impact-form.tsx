'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { setChangeOrderImpactAction } from '@/modules/scope-variation';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function SetImpactForm({
  changeOrderId,
  currentCostImpact,
  currentScheduleImpact,
}: {
  changeOrderId: string;
  currentCostImpact: string;
  currentScheduleImpact: number | string;
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await setChangeOrderImpactAction({
      id: changeOrderId,
      costImpactAmount: String(formData.get('costImpactAmount') ?? ''),
      scheduleImpactDays: Number(formData.get('scheduleImpactDays') ?? 0),
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
        <label htmlFor="costImpactAmount" className="block text-xs font-medium text-slate-700">
          Dampak biaya (Rp, boleh minus untuk pengurangan)
        </label>
        <input
          id="costImpactAmount"
          name="costImpactAmount"
          required
          inputMode="numeric"
          pattern="-?\d+"
          defaultValue={currentCostImpact}
          placeholder="mis. 45000000 atau -5000000"
          className="mt-1 w-52 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="scheduleImpactDays" className="block text-xs font-medium text-slate-700">
          Dampak jadwal (hari, boleh minus)
        </label>
        <input
          id="scheduleImpactDays"
          name="scheduleImpactDays"
          type="number"
          required
          defaultValue={currentScheduleImpact}
          className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan estimasi'}
      </button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
