'use client';

import { useActionState } from 'react';
import { createAssetAction } from '@/modules/maintenance-engine';
import type { Site } from '@/modules/crm';

type FormState = { error: string | null };

export function NewAssetForm({ sites }: { sites: Site[] }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createAssetAction({
      siteId: String(formData.get('siteId') ?? ''),
      name: String(formData.get('name') ?? ''),
      category: String(formData.get('category') ?? '') || undefined,
      manufacturer: String(formData.get('manufacturer') ?? '') || undefined,
      model: String(formData.get('model') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see cc/leads/new/lead-form.tsx's
    // own comment for why (a genuine Next.js quirk, not specific to this form).
    window.location.href = `/cc/assets/${result.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="siteId" className="block text-sm font-medium text-slate-700">
          Lokasi *
        </label>
        <select
          id="siteId"
          name="siteId"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">-- Pilih lokasi --</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Nama aset *
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="AC Split 1PK ruang tamu"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          Kategori
        </label>
        <input
          id="category"
          name="category"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="manufacturer" className="block text-sm font-medium text-slate-700">
          Merek
        </label>
        <input
          id="manufacturer"
          name="manufacturer"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="model" className="block text-sm font-medium text-slate-700">
          Model
        </label>
        <input
          id="model"
          name="model"
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
        {isPending ? 'Menyimpan...' : 'Simpan aset'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
