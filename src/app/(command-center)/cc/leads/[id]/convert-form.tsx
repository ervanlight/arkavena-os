'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { convertLeadToProjectAction, type Client, type Site } from '@/modules/crm';
import { Input, Label, Select, Textarea, Button } from '@/core/ui';

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
        <Label htmlFor="projectName">Nama proyek *</Label>
        <Input id="projectName" name="projectName" required defaultValue={defaultProjectName} />
      </div>

      <div>
        <Label htmlFor="clientId">Klien</Label>
        <Select
          id="clientId"
          name="clientId"
          value={clientChoice}
          onChange={(e) => {
            setClientChoice(e.target.value);
            setSiteChoice(NEW_SITE);
          }}
        >
          <option value={NEW_CLIENT}>-- Klien baru --</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </div>
      {clientChoice === NEW_CLIENT && (
        <div>
          <Label htmlFor="newClientName">Nama klien baru *</Label>
          <Input id="newClientName" name="newClientName" required />
        </div>
      )}

      <div>
        <Label htmlFor="siteId">Lokasi proyek</Label>
        <Select id="siteId" name="siteId" value={siteChoice} onChange={(e) => setSiteChoice(e.target.value)}>
          <option value={NEW_SITE}>-- Lokasi baru --</option>
          {sitesForClient.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
      </div>
      {siteChoice === NEW_SITE && (
        <>
          <div>
            <Label htmlFor="newSiteName">Nama lokasi baru *</Label>
            <Input id="newSiteName" name="newSiteName" required />
          </div>
          <div>
            <Label htmlFor="newSiteAddress">Alamat lokasi</Label>
            <Textarea id="newSiteAddress" name="newSiteAddress" rows={2} />
          </div>
        </>
      )}

      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Membuat proyek...' : 'Konversi ke proyek'}
      </Button>
    </form>
  );
}

const initialState: FormState = { error: null };
