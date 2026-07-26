import { FileText, Download, Lock } from 'lucide-react';
import { Card, EmptyState } from '@/core/ui';
import { listDocumentEvidenceAction } from '@/modules/evidence';

export const metadata = { title: 'Dokumen Proyek — Arkavena OS' };

export default async function DocumentsPage() {
  const result = await listDocumentEvidenceAction(undefined);
  const documents = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Dokumen Proyek</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Pusat penyimpanan dokumen resmi (Kontrak, Addendum, Gambar Kerja, &amp; Sertifikat Garansi).
        </p>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="Belum Ada Dokumen"
          description="Pusat dokumen masih kosong. Dokumen akan muncul di sini jika ada yang diunggah dari modul terkait."
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-[color:var(--color-hairline)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {doc.visibility.includes('internal') ? (
                  <Lock size={20} className="text-amber-600" />
                ) : (
                  <FileText size={20} className="text-blue-600" />
                )}
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                    {doc.storage_path.split('/').pop()}
                  </p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Proyek: {doc.project_name} &middot; Diunggah: {new Date(doc.captured_at).toLocaleDateString('id-ID')} &middot; Visibilitas: {doc.visibility.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.visibility.includes('internal') && (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    Dokumen Internal
                  </span>
                )}
                <button className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
                  <Download size={14} /> Unduh
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
