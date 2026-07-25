'use client';

import { useActionState } from 'react';
import { createLeadAction } from '@/modules/crm';
import { Card, Input, Label, Button } from '@/core/ui';

type FormState = { error: string | null };

export function NewLeadForm() {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createLeadAction({
      contactName: String(formData.get('contactName') ?? ''),
      email: String(formData.get('email') ?? '') || undefined,
      phone: String(formData.get('phone') ?? '') || undefined,
      source: String(formData.get('source') ?? '') || undefined,
      desiredStartDate: String(formData.get('desiredStartDate') ?? '') || undefined,
      estimatedValue: String(formData.get('estimatedValue') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // A hard navigation, not router.push -- a client-side transition from this
    // static /new route straight to the freshly-created /[id] route reliably
    // never commits in this Next.js version (confirmed against
    // cc/projects/new's identical pattern too, a pre-existing, unrelated bug
    // no e2e spec had exercised before this one): the server completes and
    // responds correctly, but the browser's URL/history never updates.
    window.location.href = `/cc/leads/${result.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="contactName">Nama kontak *</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div>
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" />
        </div>
        <div>
          <Label htmlFor="source">Sumber</Label>
          <Input id="source" name="source" placeholder="mis. Instagram, referral" />
        </div>
        <div>
          <Label htmlFor="desiredStartDate">Target mulai</Label>
          <Input id="desiredStartDate" name="desiredStartDate" type="date" />
        </div>
        <div>
          <Label htmlFor="estimatedValue">Estimasi nilai (Rp)</Label>
          <Input id="estimatedValue" name="estimatedValue" inputMode="numeric" placeholder="150000000" />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan lead'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
