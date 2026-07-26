import { notFound } from 'next/navigation';
import { getChangeOrderAction } from '@/modules/variations';
import { ClientDecisionForm } from './client-decision-form';
import { FileText, Image as ImageIcon, CheckCircle, Info } from 'lucide-react';

export const metadata = { title: 'Persetujuan Variation — Arkavena OS' };

/**
 * Plain-language status, never the raw enum (Fase 1 fix, IMPLEMENTATION_PRIORITIES.md F2 /
 * ARCHITECTURE_REVIEW.md's variation-approval finding): a client should never see
 * "awaiting_client_approval" interpolated into a sentence.
 *
 * Post-implementation review fix (C2): title/description/cost impact/
 * schedule impact used to render here raw -- ADR 0026 §5 is explicit that
 * scope-variation's client-facing moment must read as a simple business
 * question, "bukan 'Variation Request #24' dengan tabel dampak biaya."
 * `change_orders.client_summary` (staff-authored, set at
 * sendChangeOrderToClientAction time) replaces all four fields below.
 */
const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'sedang disiapkan tim kami',
  under_review: 'sedang ditinjau tim kami',
  awaiting_client_approval: 'menunggu keputusan Anda',
  approved_unpaid: 'Anda setujui, menunggu konfirmasi pendanaan',
  approved_funded: 'disetujui dan didanai',
  rejected: 'Anda tolak',
  completed: 'selesai dikerjakan',
};

/**
 * The "link aman" ARCHITECTURE.md 7 asks for -- reachable both as a
 * standalone link (e.g. from a notification) and now from inside the
 * navigable portal's own Keputusan page (ADR 0016, "approval variation
 * pindah ke portal"), since it shares the (client-portal) layout. Reuses
 * the same signed-in session every other role signs in with (email +
 * password, ADR 0025); proxy.ts already redirects an unauthenticated visitor to
 * /login before this page ever renders. RLS
 * (change_orders_select_client_approver) is what actually decides whether
 * this specific signed-in person can see this specific change order --
 * there is no separate token-based auth here.
 */
export default async function ApproveVariationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await getChangeOrderAction(id);

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {result.error.message}
      </p>
    );
  }

  const changeOrder = result.data;
  const alreadyDecided = changeOrder.status !== 'awaiting_client_approval';

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12 pt-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Persetujuan Pekerjaan Tambahan</h1>
        <p className="text-sm text-gray-500 mt-1">Ref: VO-{id.split('-')[0]}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#1A1A1A] overflow-hidden">
        <div className="bg-blue-500/10 border-b border-blue-500/20 p-4 flex items-start gap-3">
          <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-blue-100 leading-relaxed">
            {changeOrder.client_summary ?? 'Ada keputusan yang menunggu konfirmasi Anda'}
          </p>
        </div>
        
        <div className="p-6">
          <h3 className="text-[13px] font-semibold tracking-wider text-gray-500 uppercase mb-4">DOKUMEN PENDUKUNG</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-[#222] hover:bg-[#2A2A2A] transition-colors cursor-pointer">
              <div className="h-10 w-10 bg-red-500/10 rounded flex items-center justify-center text-red-500">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">RAB_Revisi_Atap.pdf</p>
                <p className="text-xs text-gray-500">1.2 MB &bull; Ketuk untuk melihat</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-[#222] hover:bg-[#2A2A2A] transition-colors cursor-pointer">
              <div className="h-10 w-10 bg-blue-500/10 rounded flex items-center justify-center text-blue-500">
                <ImageIcon size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">Foto_Kondisi_Lap...</p>
                <p className="text-xs text-gray-500">3 Gambar &bull; Ketuk untuk melihat</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {alreadyDecided ? (
        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 text-center">
          <CheckCircle size={32} className="mx-auto text-green-500 mb-3" />
          <p className="text-[15px] font-medium text-white">
            Variation ini {STATUS_LABEL_ID[changeOrder.status] ?? 'sudah diputuskan sebelumnya'}.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
          <h3 className="text-[13px] font-semibold tracking-wider text-gray-500 uppercase mb-4">KEPUTUSAN ANDA</h3>
          <ClientDecisionForm changeOrderId={changeOrder.id} />
        </div>
      )}
    </div>
  );
}
