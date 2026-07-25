'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { markNotificationReadAction } from '@/core/notifications';
import { Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function MarkNotificationReadForm({ notificationId }: { notificationId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async () => {
    const result = await markNotificationReadAction(notificationId);
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Menandai...' : 'Tandai dibaca'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="ml-2 text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
