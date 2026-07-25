'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceTicketAction } from '@/modules/maintenance-engine';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };

export function CreateServiceTicketForm({ assetId }: { assetId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createServiceTicketAction({
      assetId,
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="ticketTitle">Judul tiket *</Label>
        <Input id="ticketTitle" name="title" required placeholder="AC tidak dingin" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="ticketDescription">Deskripsi</Label>
        <Input id="ticketDescription" name="description" />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Membuat...' : 'Buat tiket servis'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
