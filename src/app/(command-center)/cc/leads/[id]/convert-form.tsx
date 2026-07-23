'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { convertLeadToProjectAction, type Client, type Site } from '@/modules/crm';

type FormState = { error: string | null };

const NEW_CLIENT = '__new__';
const NEW_SITE = '__new__';

export function ConvertLeadForm({
  leadId,
  defaultProjectName,
  clients,
  sites,
}: {
  leadId: string;
  defaultProjectName: string;
  clients: Client[];
  sites: Site[];
}) {
  const [clientChoice, setClientChoice] = useState(NEW_CLIENT);
  const [siteChoice, setSiteChoice] = useState(NEW_SITE);

  const sitesForClient = useMemo(
    () => sites.filter((site) => site.client_id === clientChoice),
    [sites, clientChoice],
  );

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const clientId = String(formData.get('clientId') ?? '');
    const siteId = String(formData.get('siteId') ?? '');

    const result = await convertLeadToProjectAction({
      leadId,
      projectName: String(formData.get('projectName') ?? ''),
      ...(clientId !== NEW_CLIENT ? { clientId } : { newClientName: String(formData.get('newClientName') ?? '') }),
      ...(siteId !== NEW_SITE
        ? { siteId }
        : {
            newSiteName: String(formData.get('newSiteName') ?? ''),
            newSiteAddress: String(formData.get('newSiteAddress') ?? '') || undefined,
          }),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see NewLeadForm's own comment.
    window.location.href = `/cc/projects/${result.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="projectName" className="block text-sm font-medium text-slate-700">
          Nama proyek *
        </label>
        <input
          id="projectName"
          name="projectName"
          required
          defaultValue={defaultProjectName}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="clientId" className="block text-sm font-medium text-slate-700">
          Klien
        </label>
        <select
          id="clientId"
          name="clientId"
          value={clientChoice}
          onChange={(e) => {
            setClientChoice(e.target.value);
            setSiteChoice(NEW_SITE);
          }}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value={NEW_CLIENT}>-- Klien baru --</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      {clientChoice === NEW_CLIENT && (
        <div>
          <label htmlFor="newClientName" className="block text-sm font-medium text-slate-700">
            Nama klien baru *
          </label>
          <input
            id="newClientName"
            name="newClientName"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      )}

      <div>
        <label htmlFor="siteId" className="block text-sm font-medium text-slate-700">
          Lokasi proyek
        </label>
        <select
          id="siteId"
          name="siteId"
          value={siteChoice}
          onChange={(e) => setSiteChoice(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value={NEW_SITE}>-- Lokasi baru --</option>
          {sitesForClient.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>
      {siteChoice === NEW_SITE && (
        <>
          <div>
            <label htmlFor="newSiteName" className="block text-sm font-medium text-slate-700">
              Nama lokasi baru *
            </label>
            <input
              id="newSiteName"
              name="newSiteName"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label htmlFor="newSiteAddress" className="block text-sm font-medium text-slate-700">
              Alamat lokasi
            </label>
            <textarea
              id="newSiteAddress"
              name="newSiteAddress"
              rows={2}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </>
      )}

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
        {isPending ? 'Membuat proyek...' : 'Konversi ke proyek'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
