'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { issueInvoiceAction } from '@/modules/billing';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * Rendered only when the signed-in user is Technical Director (cosmetic
 * layer, page.tsx checks roleCan) -- requirePermission() and
 * fn_invoices_guard_issuance both refuse anyone else, or an incomplete
 * invoice, regardless (ARCHITECTURE.md 7, ADR 0017).
 */
export function IssueInvoiceForm({ invoiceId, blockedReasons }: { invoiceId: string; blockedReasons: readonly string[] }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState) => {
    const result = await issueInvoiceAction({ id: invoiceId });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <div>
      {blockedReasons.length > 0 && (
        <ul className="mb-2 list-inside list-disc text-xs text-red-700">
          {blockedReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending || blockedReasons.length > 0}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {isPending ? 'Menerbitkan...' : 'Setujui & terbitkan (Technical Director)'}
        </button>
        {state.error !== null && (
          <span role="alert" className="ml-2 text-xs text-red-600">
            {state.error}
          </span>
        )}
      </form>
    </div>
  );
}
