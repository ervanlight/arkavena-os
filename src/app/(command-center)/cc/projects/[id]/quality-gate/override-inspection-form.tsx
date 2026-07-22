'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { overrideInspectionAction } from '@/modules/quality-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * Rendered only when the signed-in user is Technical Director (cosmetic
 * layer, page.tsx checks roleCan) -- requirePermission() and
 * fn_inspections_guard_td_only_override both refuse anyone else anyway
 * (ARCHITECTURE.md 4.4, ADR 0014).
 */
export function OverrideInspectionForm({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const reason = String(formData.get('reason') ?? '');
    const result = await overrideInspectionAction({ id: inspectionId, reason });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input
        name="reason"
        required
        placeholder="Alasan override (wajib, tercatat di audit log)"
        className="w-72 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
      >
        {isPending ? 'Mengirim override...' : 'Override (Technical Director)'}
      </button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
