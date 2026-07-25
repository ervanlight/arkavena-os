'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { issueInvoiceAction } from '@/modules/billing';
import { Button } from '@/core/ui';

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
        <ul className="mb-2 list-inside list-disc text-xs text-[color:var(--color-danger)]">
          {blockedReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <form action={formAction}>
        <Button type="submit" size="sm" disabled={isPending || blockedReasons.length > 0}>
          {isPending ? 'Menerbitkan...' : 'Setujui & terbitkan (Technical Director)'}
        </Button>
        {state.error !== null && (
          <span role="alert" className="ml-2 text-xs text-[color:var(--color-danger)]">
            {state.error}
          </span>
        )}
      </form>
    </div>
  );
}
