'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWarrantyAction } from '@/modules/maintenance-engine';
import { Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function MarkWarrantyExpiredForm({ warrantyId }: { warrantyId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await updateWarrantyAction({ id: warrantyId, status: 'expired' });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Menandai...' : 'Tandai berakhir'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
