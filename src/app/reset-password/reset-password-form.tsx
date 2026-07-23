'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/core/auth/login';
import { Button, Input, Label } from '@/core/ui';

type FormState = { error: string | null; done: boolean };

const initialState: FormState = { error: null, done: false };

export function ResetPasswordForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await updatePassword(formData);

    if (!result.ok) {
      return { error: result.error.message, done: false };
    }

    router.push('/');
    router.refresh();
    return { error: null, done: true };
  }, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="password">Kata sandi baru</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Minimal 8 karakter" />
      </div>

      {state.error !== null && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Menyimpan...' : 'Simpan kata sandi'}
      </Button>
    </form>
  );
}
