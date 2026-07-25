'use client';

import { useActionState } from 'react';
import { createAssessmentAction } from '@/modules/assessment';
import type { Lead, Site } from '@/modules/crm';
import { Card, Select, Label, Textarea, Button } from '@/core/ui';

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
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="siteId">Lokasi *</Label>
          <Select id="siteId" name="siteId" required defaultValue="">
            <option value="">-- Pilih lokasi --</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="leadId">Lead terkait</Label>
          <Select id="leadId" name="leadId" defaultValue="">
            <option value="">-- Tidak ada --</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.contact_name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="siteConditions">Kondisi lokasi</Label>
          <Textarea id="siteConditions" name="siteConditions" rows={3} />
        </div>
        <div>
          <Label htmlFor="recommendedScope">Ruang lingkup direkomendasikan</Label>
          <Textarea id="recommendedScope" name="recommendedScope" rows={3} />
        </div>
        <div>
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan assessment'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
