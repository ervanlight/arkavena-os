'use client';

import { useActionState } from 'react';
import { createSiteAction } from '@/modules/crm';
import type { Client } from '@/modules/crm';
import { createProjectAction } from '@/modules/projects';
import { Card, Label, Input, Select, Textarea, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * Creates a site alongside the project rather than picking an existing one.
 * projects.site_id is not-null (ADR 0007); Fase 1 has no site-management UI
 * of its own yet, so the simplest correct path is creating the site the
 * project needs at the same time, not building a second full CRUD screen for
 * a table nothing else surfaces yet.
 */
export function NewProjectForm({ clients }: { clients: Client[] }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const clientId = String(formData.get('clientId') ?? '');
    const siteName = String(formData.get('siteName') ?? '');
    const siteAddress = String(formData.get('siteAddress') ?? '') || undefined;
    const projectName = String(formData.get('projectName') ?? '');
    const startDate = String(formData.get('startDate') ?? '') || undefined;

    const siteResult = await createSiteAction({ clientId, name: siteName, address: siteAddress });
    if (!siteResult.ok) {
      return { error: siteResult.error.message };
    }

    const projectResult = await createProjectAction({
      clientId,
      siteId: siteResult.data.id,
      name: projectName,
      startDate,
    });
    if (!projectResult.ok) {
      return { error: projectResult.error.message };
    }

    // Hard navigation, not router.push: a client-side transition from this
    // static /new route straight to the freshly-created /[id] route never
    // reliably commits in this Next.js version -- the server completes and
    // responds correctly, but the browser's own URL/history never updates.
    // No prior e2e spec had ever clicked through this form and asserted the
    // resulting redirect, which is why this went unnoticed until Fase 8's
    // own new create-forms hit the identical pattern and made it visible.
    window.location.href = `/cc/projects/${projectResult.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="clientId">Klien *</Label>
          <Select id="clientId" name="clientId" required defaultValue="">
            <option value="" disabled>
              Pilih klien
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
          {clients.length === 0 && (
            <p className="mt-1 text-xs text-[color:var(--color-warning)]">Belum ada klien. Tambahkan klien terlebih dahulu.</p>
          )}
        </div>

        <div className="border-t border-[color:var(--color-hairline)] pt-4">
          <p className="text-sm font-medium text-[color:var(--color-ink-secondary)]">Lokasi proyek</p>
          <div className="mt-2 space-y-3">
            <div>
              <Label htmlFor="siteName">Nama lokasi *</Label>
              <Input id="siteName" name="siteName" required placeholder="mis. Rumah Pak Budi — Jl. Merdeka No. 10" />
            </div>
            <div>
              <Label htmlFor="siteAddress">Alamat</Label>
              <Textarea id="siteAddress" name="siteAddress" rows={2} />
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--color-hairline)] pt-4">
          <Label htmlFor="projectName">Nama proyek *</Label>
          <Input id="projectName" name="projectName" required />
        </div>

        <div>
          <Label htmlFor="startDate">Tanggal mulai</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan proyek'}
        </Button>
      </form>
    </Card>
  );
}
