'use client';

import { useActionState } from 'react';
import { createAssessmentAction } from '@/modules/assessment';
import type { Lead, Site } from '@/modules/crm';

type FormState = { error: string | null };

export function NewAssessmentForm({ sites, leads }: { sites: Site[]; leads: Lead[] }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const leadId = String(formData.get('leadId') ?? '');

    const result = await createAssessmentAction({
      siteId: String(formData.get('siteId') ?? ''),
      ...(leadId !== '' ? { leadId } : {}),
      siteConditions: String(formData.get('siteConditions') ?? '') || undefined,
      recommendedScope: String(formData.get('recommendedScope') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see NewLeadForm's own comment.
    window.location.href = `/cc/assessments/${result.data.id}`;
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
        <label htmlFor="leadId" className="block text-sm font-medium text-slate-700">
          Lead terkait
        </label>
        <select
          id="leadId"
          name="leadId"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">-- Tidak ada --</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.contact_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="siteConditions" className="block text-sm font-medium text-slate-700">
          Kondisi lokasi
        </label>
        <textarea
          id="siteConditions"
          name="siteConditions"
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="recommendedScope" className="block text-sm font-medium text-slate-700">
          Ruang lingkup direkomendasikan
        </label>
        <textarea
          id="recommendedScope"
          name="recommendedScope"
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Catatan
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
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
        {isPending ? 'Menyimpan...' : 'Simpan assessment'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
