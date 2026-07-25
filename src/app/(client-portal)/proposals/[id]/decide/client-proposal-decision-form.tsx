'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { clientDecideProposalAction } from '@/modules/estimating';
import { Button, Input, Textarea, Label } from '@/core/ui';

type FormState = { error: string | null; ok: boolean };
const initialState: FormState = { error: null, ok: false };

export function ClientProposalDecisionForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();

  const [acceptState, acceptAction, isAccepting] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await clientDecideProposalAction({
      id: proposalId,
      decision: 'accepted',
      reason: String(formData.get('acceptReason') ?? ''),
    });
    if (!result.ok) return { error: result.error.message, ok: false };
    router.refresh();
    return { error: null, ok: true };
  }, initialState);

  const [rejectState, rejectAction, isRejecting] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await clientDecideProposalAction({
      id: proposalId,
      decision: 'rejected',
      reason: String(formData.get('rejectReason') ?? ''),
    });
    if (!result.ok) return { error: result.error.message, ok: false };
    router.refresh();
    return { error: null, ok: true };
  }, initialState);

  return (
    <div className="space-y-6">
      <form action={acceptAction} className="space-y-2">
        <Label htmlFor="acceptReason">Catatan persetujuan</Label>
        <Input id="acceptReason" name="acceptReason" required placeholder="mis. Setuju, silakan lanjutkan" />
        <Button type="submit" disabled={isAccepting} className="w-full">
          {isAccepting ? 'Mengirim...' : 'Terima proposal ini'}
        </Button>
        {acceptState.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {acceptState.error}
          </p>
        )}
      </form>

      <form action={rejectAction} className="space-y-2 border-t border-[color:var(--color-hairline)] pt-6">
        <Label htmlFor="rejectReason">Atau tolak (alasan wajib)</Label>
        <Textarea id="rejectReason" name="rejectReason" rows={2} required placeholder="mis. Belum sesuai anggaran" />
        <Button type="submit" variant="destructive" disabled={isRejecting} className="w-full">
          {isRejecting ? 'Mengirim...' : 'Tolak proposal ini'}
        </Button>
        {rejectState.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {rejectState.error}
          </p>
        )}
      </form>
    </div>
  );
}
