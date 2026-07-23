'use client';

import { useActionState } from 'react';
import { createLeadAction } from '@/modules/crm';

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
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-slate-700">
          Nama kontak *
        </label>
        <input
          id="contactName"
          name="contactName"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
          Telepon
        </label>
        <input
          id="phone"
          name="phone"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="source" className="block text-sm font-medium text-slate-700">
          Sumber
        </label>
        <input
          id="source"
          name="source"
          placeholder="mis. Instagram, referral"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="desiredStartDate" className="block text-sm font-medium text-slate-700">
          Target mulai
        </label>
        <input
          id="desiredStartDate"
          name="desiredStartDate"
          type="date"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="estimatedValue" className="block text-sm font-medium text-slate-700">
          Estimasi nilai (Rp)
        </label>
        <input
          id="estimatedValue"
          name="estimatedValue"
          inputMode="numeric"
          placeholder="150000000"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan lead'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
