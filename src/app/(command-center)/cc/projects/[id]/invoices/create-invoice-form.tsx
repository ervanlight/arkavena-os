'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createInvoiceAction } from '@/modules/invoice-generator';
import { Label, Input, Select, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

type MilestoneOption = { id: string; label: string };
type ChangeOrderOption = { id: string; title: string };

export function CreateInvoiceForm({
  projectId,
  milestones,
  changeOrders,
}: {
  projectId: string;
  milestones: MilestoneOption[];
  changeOrders: ChangeOrderOption[];
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const changeOrderId = String(formData.get('changeOrderId') ?? '');
    const result = await createInvoiceAction({
      projectId,
      milestoneId: String(formData.get('milestoneId') ?? ''),
      changeOrderId: changeOrderId === '' ? undefined : changeOrderId,
      title: String(formData.get('title') ?? '').trim(),
      amount: String(formData.get('amount') ?? '').trim(),
      dueDate: String(formData.get('dueDate') ?? ''),
    });

    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="invoiceTitle">Judul invoice</Label>
        <Input id="invoiceTitle" name="title" required placeholder="mis. Termin 1 - Pekerjaan Pondasi" />
      </div>
      <div>
        <Label htmlFor="invoiceMilestoneId">Milestone</Label>
        <Select id="invoiceMilestoneId" name="milestoneId" required defaultValue="">
          <option value="">Pilih milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="invoiceChangeOrderId">Variation terkait (opsional)</Label>
        <Select id="invoiceChangeOrderId" name="changeOrderId" defaultValue="">
          <option value="">Tidak ada</option>
          {changeOrders.map((co) => (
            <option key={co.id} value={co.id}>
              {co.title}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="invoiceAmount">Nominal (Rp)</Label>
        <Input id="invoiceAmount" name="amount" required placeholder="mis. 50000000" />
      </div>
      <div>
        <Label htmlFor="invoiceDueDate">Jatuh tempo</Label>
        <Input id="invoiceDueDate" name="dueDate" type="date" required />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? 'Menyimpan...' : 'Buat invoice (draft)'}
        </Button>
      </div>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)] sm:col-span-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
