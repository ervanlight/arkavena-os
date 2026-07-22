'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkPackageAction } from '@/modules/projects';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * The only place a work package's work_type gets set through the UI --
 * OpenWorkPackageForm (variation flow) has no such field, so a work package
 * arrives here with work_type null until someone assigns one here. Without
 * it, trg_work_packages_guard_hold_point (ADR 0014) has nothing to check
 * against and every hold point stays invisible.
 */
export function SetWorkTypeForm({ workPackageId }: { workPackageId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const workType = String(formData.get('workType') ?? '').trim();
    const result = await updateWorkPackageAction({ id: workPackageId, workType });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input
        name="workType"
        required
        placeholder="mis. waterproofing"
        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Tetapkan jenis pekerjaan'}
      </button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
