'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { sendProposalAction } from '@/modules/estimating';
import { Button, Label, Textarea } from '@/core/ui';

type FormState = { error: string | null };

export function SendProposalForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const clientSummary = String(formData.get('clientSummary') ?? '').trim();
    const result = await sendProposalAction({
      id: proposalId,
      ...(clientSummary !== '' ? { clientSummary } : {}),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Label htmlFor="sendProposalClientSummary">Ringkasan untuk klien (opsional)</Label>
      <Textarea
        id="sendProposalClientSummary"
        name="clientSummary"
        rows={2}
        placeholder="mis. Proposal renovasi dapur Anda sudah siap untuk ditinjau"
      />
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Mengirim...' : 'Kirim proposal'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
