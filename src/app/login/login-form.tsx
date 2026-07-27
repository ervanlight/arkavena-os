'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPassword } from '@/core/auth/login';
import { Button, Input, Label } from '@/core/ui';

type FormState = { error: string | null; email: string };

const initialState: FormState = { error: null, email: '' };

/** Email + password sign-in (ADR 0025, reversing owner decision D4's magic link). */
export function LoginForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const email = String(formData.get('email') ?? '');
    const result = await signInWithPassword(formData);

    if (!result.ok) {
      return { error: result.error.message, email };
    }

    router.push('/');
    router.refresh();
    return { error: null, email };
  }, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="email">ID / Email Login</Label>
        <Input
          id="email"
          name="email"
          type="text"
          required
          autoComplete="username"
          defaultValue={state.email}
          placeholder="Contoh: klien.budi atau budi@arkavena.com"
        />
      </div>

      <div>
        <Label htmlFor="password">Kata sandi</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </div>

      {state.error !== null && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Masuk...' : 'Masuk'}
      </Button>

      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-[color:var(--color-accent)] hover:underline">
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}
