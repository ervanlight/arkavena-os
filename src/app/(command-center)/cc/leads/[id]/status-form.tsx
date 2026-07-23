'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateLeadStatusAction } from '@/modules/crm';

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
        <label htmlFor="status" className="block text-sm font-medium text-slate-700">
          Status baru
        </label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="lostReason" className="block text-sm font-medium text-slate-700">
          Alasan lost (wajib jika status Lost)
        </label>
        <input
          id="lostReason"
          name="lostReason"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Ubah status'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
