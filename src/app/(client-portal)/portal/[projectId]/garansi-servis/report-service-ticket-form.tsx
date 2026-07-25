'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceTicketAsClientAction } from '@/modules/maintenance-engine';
import { Button, Input, Label, Select, Textarea } from '@/core/ui';

type FormState = { error: string | null; ok: boolean };
const initialState: FormState = { error: null, ok: false };

export function ReportServiceTicketForm({ assets }: { assets: { id: string; name: string }[] }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createServiceTicketAsClientAction({
      assetId: String(formData.get('assetId') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });
    if (!result.ok) return { error: result.error.message, ok: false };
    router.refresh();
    return { error: null, ok: true };
  }, initialState);

  if (assets.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-secondary)]">
        Belum ada aset tercatat untuk proyek Anda -- hubungi tim kami untuk melaporkan masalah.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="reportAssetId">Aset yang bermasalah</Label>
        <Select id="reportAssetId" name="assetId" required defaultValue="">
          <option value="" disabled>
            Pilih aset
          </option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reportTitle">Ringkasan masalah</Label>
        <Input id="reportTitle" name="title" required placeholder="mis. AC kamar utama tidak dingin" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reportDescription">Detail (opsional)</Label>
        <Textarea id="reportDescription" name="description" rows={3} placeholder="Ceritakan lebih lengkap kalau perlu" />
      </div>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Mengirim...' : 'Laporkan masalah'}
      </Button>
    </form>
  );
}
