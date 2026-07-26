'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { clientDecideProposalAction } from '@/modules/client-feed';

export function ClientDecisionClient({ proposalId, status }: { proposalId: string, status: string }) {
  const router = useRouter();

  const [, acceptAction, isAccepting] = useActionState(async (_prev: any, _formData: FormData) => {
    const result = await clientDecideProposalAction({ proposalId, decision: 'accepted', reason: '' });
    if (!result.ok) {
      alert('Gagal menyetujui RAB');
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });

  const [, rejectAction, isRejecting] = useActionState(async (_prev: any, _formData: FormData) => {
    const result = await clientDecideProposalAction({ proposalId, decision: 'rejected', reason: '' });
    if (!result.ok) {
      alert('Gagal menolak RAB');
      return { ok: false };
    }
    router.refresh();
    return { ok: true };
  }, { ok: false });


  if (status === 'accepted') {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
        <h3 className="text-lg font-semibold text-green-500 mb-2">RAB Telah Disetujui</h3>
        <p className="text-sm text-green-400/70">Terima kasih, Anda telah menyetujui anggaran ini. Proyek dapat dilanjutkan.</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <h3 className="text-lg font-semibold text-red-500 mb-2">RAB Ditolak</h3>
        <p className="text-sm text-red-400/70">Anda menolak anggaran ini. Silakan hubungi tim kami untuk penyesuaian.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 text-center space-y-4">
      <h3 className="text-lg font-semibold text-white">Keputusan Anda</h3>
      <p className="text-sm text-gray-400">Silakan tinjau rincian anggaran di atas. Apakah Anda menyetujuinya?</p>
      
      <div className="flex items-center justify-center gap-4 pt-2">
        <form action={rejectAction}>
          <button 
            type="submit"
            disabled={isAccepting || isRejecting}
            onClick={(e) => {
              if(!confirm('Yakin ingin menolak RAB ini?')) e.preventDefault();
            }}
            className="px-6 py-2.5 rounded-lg border border-red-500/30 text-red-400 font-medium hover:bg-red-500/10 transition-colors"
          >
            Tolak Anggaran
          </button>
        </form>
        <form action={acceptAction}>
          <button 
            type="submit"
            disabled={isAccepting || isRejecting}
            onClick={(e) => {
              if(!confirm('Yakin ingin menyetujui RAB ini?')) e.preventDefault();
            }}
            className="px-8 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
          >
            Setujui RAB
          </button>
        </form>
      </div>
    </div>
  );
}
