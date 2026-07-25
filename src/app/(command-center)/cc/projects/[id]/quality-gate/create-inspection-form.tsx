'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createInspectionAction } from '@/modules/quality-gate';
import { Button } from '@/core/ui';

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
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Membuat...' : 'Mulai pemeriksaan'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
