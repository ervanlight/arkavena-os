'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { setRiskReserveAction } from '@/modules/cash-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function RiskReserveForm({ projectId, currentAmount }: { projectId: string; currentAmount: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await setRiskReserveAction({
      projectId,
      riskReserveAmount: String(formData.get('riskReserveAmount') ?? ''),
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
        <label htmlFor="riskReserveAmount" className="block text-xs font-medium text-slate-700">
          Nominal cadangan (Rp)
        </label>
        <input
          id="riskReserveAmount"
          name="riskReserveAmount"
          required
          inputMode="numeric"
          pattern="\d+"
          defaultValue={currentAmount}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan'}
      </button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
