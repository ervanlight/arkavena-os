import { redirect } from 'next/navigation';
import { Card, Button, Label, Input, Textarea } from '@/core/ui';

export const metadata = { title: 'Upload RAB — SiteFlow' };

export default async function RabUploadPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (!projectId) redirect('/site');

  return (
    <div className="space-y-4 pb-20">
      <header className="mb-4">
         <h1 className="text-xl font-bold text-[color:var(--color-ink)]">Unggah Penawaran (RAB)</h1>
         <p className="text-sm text-[color:var(--color-ink-secondary)]">Tugas: Addendum Atap</p>
      </header>
      
      <Card>
        <form className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label>File RAB (PDF / Excel)</Label>
              <div className="mt-1 flex h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-secondary)]">
                <input type="file" accept=".pdf,.xls,.xlsx" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="text-sm font-medium">Ketuk untuk Mengunggah</span>
              </div>
            </div>

            <div>
              <Label htmlFor="total">Total Penawaran (Rp)</Label>
              <Input id="total" type="number" placeholder="Contoh: 15000000" inputMode="numeric" />
            </div>

            <div>
              <Label htmlFor="notes">Catatan Tambahan (Opsional)</Label>
              <Textarea id="notes" rows={2} placeholder="Keterangan mengenai RAB..." />
            </div>
          </div>

          <Button type="button" variant="primary" className="w-full mt-4 py-4 text-md font-bold">
            Kirim RAB
          </Button>
        </form>
      </Card>
    </div>
  );
}
