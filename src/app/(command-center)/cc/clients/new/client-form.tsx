'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientAction } from '@/modules/crm';
import { Card, Input, Label, Textarea, Button } from '@/core/ui';

type FormState = { error: string | null };

/**
 * safeAction-wrapped actions take a plain object matching their Zod schema,
 * not FormData -- so this reads the form fields into an object itself rather
 * than passing the FormData straight through, unlike the login form
 * (which is a hand-written action reading FormData.get() directly).
 */
export function NewClientForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createClientAction({
      name: String(formData.get('name') ?? ''),
      contactName: String(formData.get('contactName') ?? '') || undefined,
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? '') || undefined,
      address: String(formData.get('address') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.push('/cc/clients');
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name">Nama klien *</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="contactName">Nama kontak</Label>
          <Input id="contactName" name="contactName" />
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
          <Label htmlFor="address">Alamat</Label>
          <Textarea id="address" name="address" rows={2} />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan klien'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
