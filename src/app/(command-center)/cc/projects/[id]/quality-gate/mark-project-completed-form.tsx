'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProjectAction } from '@/modules/projects';
import { Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * F15: the UI trigger for projects.status -> 'completed'. Only meaningfully
 * usable once a project_completion_signoffs row exists -- but
 * trg_projects_guard_completion_signoff is the real enforcement either way
 * (CLAUDE.md 0.3), so this button is offered regardless and simply surfaces
 * the trigger's refusal if clicked too early.
 */
export function MarkProjectCompletedForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async () => {
    const result = await updateProjectAction({ id: projectId, status: 'completed' });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Menandai selesai...' : 'Tandai proyek selesai'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
