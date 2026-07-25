'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeliveryAction } from '@/modules/procurement';
import { Button, Input, Label } from '@/core/ui';

type FormState = { error: string | null };

export function CreateDeliveryForm({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createDeliveryAction({
      purchaseOrderId,
      notes: String(formData.get('notes') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <Label htmlFor={`notes-${purchaseOrderId}`} className="text-xs">
          Catatan pengiriman
        </Label>
        <Input id={`notes-${purchaseOrderId}`} name="notes" className="py-1.5" />
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Mencatat...' : 'Catat pengiriman'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
