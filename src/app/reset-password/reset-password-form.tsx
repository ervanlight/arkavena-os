'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/core/auth/login';

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
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Kata sandi baru
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="Minimal 8 karakter"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan kata sandi'}
      </button>
    </form>
  );
}
