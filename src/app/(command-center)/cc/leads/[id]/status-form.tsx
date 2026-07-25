'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateLeadStatusAction } from '@/modules/crm';
import { Input, Label, Select, Button } from '@/core/ui';

type FormState = { error: string | null };

const STATUSES = [
  { value: 'new', label: 'Baru' },
  { value: 'contacted', label: 'Dihubungi' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'assessment_scheduled', label: 'Assessment terjadwal' },
  { value: 'proposal_sent', label: 'Proposal terkirim' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const;

/**
 * Offers every status, not just the legal next ones -- fn_leads_guard_transition
 * and modules/crm/domain/lead-transition.ts's transition() both still enforce
 * the real graph server-side; an illegal pick just comes back as this form's
 * error message instead of a hidden option (CLAUDE.md 0.3, UI = cosmetic layer).
 */
export function LeadStatusForm({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const status = String(formData.get('status') ?? '');
    const lostReason = String(formData.get('lostReason') ?? '') || undefined;

    const result = await updateLeadStatusAction({
      id: leadId,
      status: status as never,
      ...(lostReason !== undefined ? { lostReason } : {}),
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
        <Label htmlFor="status">Status baru</Label>
        <Select id="status" name="status" defaultValue={currentStatus}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="lostReason">Alasan lost (wajib jika status Lost)</Label>
        <Input id="lostReason" name="lostReason" />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Ubah status'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
