'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateServiceTicketStatusAction } from '@/modules/maintenance-engine';
import { Button } from '@/core/ui';

type FormState = { error: string | null };

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  open: [
    { value: 'in_progress', label: 'Mulai dikerjakan' },
    { value: 'cancelled', label: 'Batalkan' },
  ],
  in_progress: [
    { value: 'resolved', label: 'Selesaikan' },
    { value: 'cancelled', label: 'Batalkan' },
  ],
};

export function ServiceTicketStatusForm({ ticketId, currentStatus }: { ticketId: string; currentStatus: string }) {
  const router = useRouter();
  const options = NEXT_STATUSES[currentStatus] ?? [];

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const status = String(formData.get('status') ?? '');
    const result = await updateServiceTicketStatusAction({ id: ticketId, status: status as never });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  if (options.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="submit"
          name="status"
          value={option.value}
          variant={option.value === 'cancelled' ? 'destructive' : 'secondary'}
          size="sm"
          disabled={isPending}
        >
          {option.label}
        </Button>
      ))}
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
