'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createProjectCompletionSignoffAction } from '@/modules/quality-gate';
import { Button, Input } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * Rendered only when the signed-in user is Technical Director (cosmetic
 * layer, page.tsx checks roleCan) -- requirePermission() and
 * fn_project_completion_signoffs_guard_td_only both refuse anyone else
 * anyway (ARCHITECTURE.md 4.4, F15).
 */
export function ProjectCompletionSignoffForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const notes = String(formData.get('notes') ?? '');
    const result = await createProjectCompletionSignoffAction({
      projectId,
      ...(notes.trim() !== '' ? { notes } : {}),
    });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <Input name="notes" placeholder="Catatan serah terima final (opsional)" className="w-72" />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menandatangani...' : 'Tandatangani serah terima final (Technical Director)'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
