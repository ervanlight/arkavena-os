'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createVendorAction } from '@/modules/procurement';
import { Card, Label, Input, Textarea, Button } from '@/core/ui';

type FormState = { error: string | null };

export function NewVendorForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createVendorAction({
      name: String(formData.get('name') ?? ''),
      contactName: String(formData.get('contactName') ?? '') || undefined,
      email: String(formData.get('email') ?? '') || undefined,
      phone: String(formData.get('phone') ?? '') || undefined,
      address: String(formData.get('address') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.push('/cc/vendors');
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name">Nama vendor *</Label>
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
          {isPending ? 'Menyimpan...' : 'Simpan vendor'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
