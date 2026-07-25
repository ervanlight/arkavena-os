'use client';

import { useActionState } from 'react';
import { createAssetAction } from '@/modules/maintenance-engine';
import type { Site } from '@/modules/crm';
import { Card, Label, Input, Select, Button } from '@/core/ui';

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
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="siteId">Lokasi *</Label>
          <Select id="siteId" name="siteId" required>
            <option value="">-- Pilih lokasi --</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="name">Nama aset *</Label>
          <Input id="name" name="name" required placeholder="AC Split 1PK ruang tamu" />
        </div>
        <div>
          <Label htmlFor="category">Kategori</Label>
          <Input id="category" name="category" />
        </div>
        <div>
          <Label htmlFor="manufacturer">Merek</Label>
          <Input id="manufacturer" name="manufacturer" />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan aset'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
