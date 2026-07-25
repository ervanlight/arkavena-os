'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkPackageAction } from '@/modules/projects';
import { Button, Input } from '@/core/ui';

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
      <Input name="workType" required placeholder="mis. waterproofing" className="w-40" />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Tetapkan jenis pekerjaan'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
