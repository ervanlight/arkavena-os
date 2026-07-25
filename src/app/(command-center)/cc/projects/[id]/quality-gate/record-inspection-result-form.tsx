'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { recordInspectionResultAction } from '@/modules/quality-gate';
import { Button } from '@/core/ui';

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
      <Button type="submit" name="status" value="passed" size="sm" disabled={isPending}>
        Lulus
      </Button>
      <Button type="submit" name="status" value="failed" size="sm" variant="destructive" disabled={isPending}>
        Tidak lulus
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
