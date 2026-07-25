'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { overrideIssuePurchaseOrderAction, type Vendor, type VendorQuote } from '@/modules/procurement';
import { Button, Input, Label, Select, Textarea } from '@/core/ui';

type FormState = { error: string | null };

/**
 * The one path that issues a PO under a red/overdue Cash Gate (ADR 0010).
 * requirePermission (cash_gate_override.create -> owner only) is why this
 * page only renders the form for an owner; trg_cash_gate_overrides_guard_owner_only
 * is the real, unbypassable authority either way (CLAUDE.md 0.3).
 */
export function OverridePurchaseOrderForm({
  projectId,
  vendors,
  quotes,
}: {
  projectId: string;
  vendors: Vendor[];
  quotes: VendorQuote[];
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const vendorQuoteId = String(formData.get('vendorQuoteId') ?? '');

    const result = await overrideIssuePurchaseOrderAction({
      projectId,
      vendorId: String(formData.get('vendorId') ?? ''),
      ...(vendorQuoteId !== '' ? { vendorQuoteId } : {}),
      description: String(formData.get('description') ?? ''),
      amount: String(formData.get('amount') ?? ''),
      reason: String(formData.get('reason') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="override-vendorId">Vendor *</Label>
        <Select id="override-vendorId" name="vendorId" required>
          <option value="">-- Pilih vendor --</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="override-vendorQuoteId">Dari penawaran</Label>
        <Select id="override-vendorQuoteId" name="vendorQuoteId">
          <option value="">-- Langsung, tanpa penawaran --</option>
          {quotes.map((quote) => (
            <option key={quote.id} value={quote.id}>
              {quote.description}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="override-description">Deskripsi *</Label>
        <Input id="override-description" name="description" required />
      </div>
      <div>
        <Label htmlFor="override-amount">Nominal (Rp) *</Label>
        <Input id="override-amount" name="amount" required inputMode="numeric" />
      </div>
      <div className="col-span-full">
        <Label htmlFor="override-reason">Alasan override *</Label>
        <Textarea id="override-reason" name="reason" required rows={2} />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? 'Menerbitkan...' : 'Override dan terbitkan PO'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
