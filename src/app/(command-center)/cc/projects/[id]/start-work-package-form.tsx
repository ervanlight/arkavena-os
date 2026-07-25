'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkPackageAction } from '@/modules/projects';
import { Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * The Cash Gate's real gate for the common case: no override, no variation
 * -- just an ordinary work package moving to in_progress, which
 * trg_work_packages_guard_cash_gate (Fase 2) blocks outright when the gate
 * is red/overdue. Fase 1 never got a UI control for this transition at all
 * (only the override path, Fase 2's cash-gate dashboard, ever called
 * updateWorkPackageAction with status in_progress) -- added here so the
 * green-gate happy path is something a real click can drive, not just a
 * server action called directly.
 */
export function StartWorkPackageForm({ workPackageId }: { workPackageId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await updateWorkPackageAction({ id: workPackageId, status: 'in_progress' });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Memulai...' : 'Mulai pekerjaan'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
