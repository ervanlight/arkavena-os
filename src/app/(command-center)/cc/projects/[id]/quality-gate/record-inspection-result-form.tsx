'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { recordInspectionResultAction } from '@/modules/quality-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function RecordInspectionResultForm({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const status = String(formData.get('status') ?? '');
    if (status !== 'passed' && status !== 'failed') return { error: 'Status tidak valid' };
    const result = await recordInspectionResultAction({ id: inspectionId, status });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        name="status"
        value="passed"
        disabled={isPending}
        className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        Lulus
      </button>
      <button
        type="submit"
        name="status"
        value="failed"
        disabled={isPending}
        className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
      >
        Tidak lulus
      </button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
