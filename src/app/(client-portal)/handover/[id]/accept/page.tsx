import { notFound } from 'next/navigation';
import { getClientDecisionAction } from '@/modules/client-feed';
import { ClientHandoverDecisionForm } from './client-handover-decision-form';
import { Card, Button } from '@/core/ui';
import { CheckCircle, FileText, Download, PartyPopper, Camera } from 'lucide-react';

export const metadata = { title: 'Konfirmasi Serah Terima — Arkavena OS' };

/**
 * Phase 3 (F6): a client's handover sign-off moment, mirroring
 * /proposals/[id]/decide exactly. Keyed by the client_decisions row's own
 * id (the route's [id]) -- a handover sign-off has no separate source row
 * the way a change_order/proposal does, so there is no other id to key by.
 */
export default async function AcceptHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientDecisionId } = await params;

  const result = await getClientDecisionAction(clientDecisionId);

  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const decision = result.data;
  if (decision === null || !decision.handover_signoff) notFound();

  const alreadyDecided = decision.decided_at !== null;

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-20">
      <div className="text-center mb-10 mt-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4 shadow-sm">
          <PartyPopper size={32} />
        </div>
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Selamat, Proyek Anda Telah Selesai!</h1>
        <p className="text-[15px] text-[color:var(--color-ink-secondary)] mt-2">
          Terima kasih telah mempercayakan perjalanan pembangunan Anda kepada Arkavena.
        </p>
      </div>

      <Card className="overflow-hidden border-0 shadow-[var(--shadow-sheet)]">
        {/* Placeholder for Final Photos */}
        <div className="h-48 bg-[color:var(--color-canvas)] w-full relative flex items-center justify-center border-b border-[color:var(--color-hairline)]">
          <span className="text-sm font-medium text-[color:var(--color-ink-tertiary)] flex items-center gap-2">
             <Camera size={16} /> Foto Hasil Akhir Proyek
          </span>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 leading-relaxed">
            {decision.client_summary ?? 'Tahap pengerjaan fisik telah dinyatakan rampung 100% dan telah melewati Quality Control Arkavena. Mohon tinjau dokumen serah terima di bawah ini sebelum memberikan konfirmasi.'}
          </div>

          <div>
             <h3 className="text-[15px] font-bold text-[color:var(--color-ink)] mb-3 flex items-center gap-2">
               <FileText size={18} className="text-[color:var(--color-ink-secondary)]" /> Dokumen Serah Terima
             </h3>
             <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)]">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-red-100 text-red-600 flex items-center justify-center">PDF</div>
                     <div>
                       <p className="text-sm font-semibold text-[color:var(--color-ink)]">Berita Acara Serah Terima (BAST)</p>
                       <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">Ditandatangani oleh Project Manager</p>
                     </div>
                   </div>
                   <Button size="sm" variant="secondary" className="gap-2">
                     <Download size={14} /> Unduh
                   </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)]">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-red-100 text-red-600 flex items-center justify-center">PDF</div>
                     <div>
                       <p className="text-sm font-semibold text-[color:var(--color-ink)]">Sertifikat Garansi Retensi</p>
                       <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">Masa berlaku 3 bulan</p>
                     </div>
                   </div>
                   <Button size="sm" variant="secondary" className="gap-2">
                     <Download size={14} /> Unduh
                   </Button>
                </div>
             </div>
          </div>
          
          <div className="pt-4 border-t border-[color:var(--color-hairline)]">
             {alreadyDecided ? (
               <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl text-green-800">
                  <CheckCircle size={20} />
                  <div>
                    <p className="text-sm font-bold">Serah Terima Dikonfirmasi</p>
                    <p className="text-xs mt-0.5">Terima kasih atas kerja samanya. Status proyek Anda: Selesai.</p>
                  </div>
               </div>
             ) : (
               <ClientHandoverDecisionForm clientDecisionId={decision.id} />
             )}
          </div>
        </div>
      </Card>
    </div>
  );
}
