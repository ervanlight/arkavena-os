'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { decideProposalAction } from '@/modules/estimating';
import { Button, Label, Select, Textarea } from '@/core/ui';

type FormState = { error: string | null };

export function DecideProposalForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await decideProposalAction({
      id: proposalId,
      decision: String(formData.get('decision') ?? '') as 'accepted' | 'rejected',
      reason: String(formData.get('reason') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <Label htmlFor="decision">Keputusan *</Label>
        <Select id="decision" name="decision" required>
          <option value="accepted">Diterima</option>
          <option value="rejected">Ditolak</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="reason">Alasan *</Label>
        <Textarea id="reason" name="reason" required rows={3} />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Simpan keputusan'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
