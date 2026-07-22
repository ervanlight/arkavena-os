'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createInspectionAction } from '@/modules/quality-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CreateInspectionForm({
  projectId,
  workPackageId,
  zoneId,
  holdPointTemplateId,
}: {
  projectId: string;
  workPackageId: string;
  zoneId: string;
  holdPointTemplateId: string;
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await createInspectionAction({ projectId, workPackageId, zoneId, holdPointTemplateId });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? 'Membuat...' : 'Mulai pemeriksaan'}
      </button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
