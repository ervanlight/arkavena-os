'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset } from '@/core/auth/login';
import { Button, Input, Label } from '@/core/ui';

type FormState = { status: 'idle' | 'sent'; email: string; error: string | null };

const initialState: FormState = { status: 'idle', email: '', error: null };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await requestPasswordReset(formData);
    const email = String(formData.get('email') ?? '');

    if (!result.ok) {
      return { status: 'idle' as const, email, error: result.error.message };
    }
    return { status: 'sent' as const, email: result.data.email, error: null };
  }, initialState);

  if (state.status === 'sent') {
    return (
      <div role="status" className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-success)]/12 text-2xl">
          ✓
        </div>
        <p className="text-[17px] font-semibold text-[color:var(--color-ink)]">Periksa email Anda</p>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Kami mengirim tautan atur ulang kata sandi ke <span className="font-medium text-[color:var(--color-ink)]">{state.email}</span>, jika
          alamat tersebut terdaftar.
        </p>
        <Link href="/login" className="inline-block text-sm text-[color:var(--color-accent)] hover:underline">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="email">Alamat email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          placeholder="nama@perusahaan.com"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Mengirim...' : 'Kirim tautan atur ulang'}
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-[color:var(--color-accent)] hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </form>
  );
}
