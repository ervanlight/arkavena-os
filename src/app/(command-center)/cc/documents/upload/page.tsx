import { Card, PageHeader } from '@/core/ui';

export const metadata = { title: 'Unggah Dokumen — Arkavena OS' };

export default function DocumentUploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Unggah Dokumen" subtitle="Pilih proyek dan lampirkan dokumen pendukung untuk dibagikan ke klien atau tim." />
      
      <Card>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Fitur pengunggahan dokumen sedang dalam tahap pengembangan.
        </p>
      </Card>
    </div>
  );
}
