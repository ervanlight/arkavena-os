import { notFound } from 'next/navigation';
import { getClientProjectOverviewAction } from '@/modules/client-feed';
import { getClientProposal } from '@/modules/partner-rab/data/client-repository';
import { PortalNav } from '../../portal-nav';
import { FileSignature } from 'lucide-react';
import { formatRp, toRupiah } from '@/core/money/rupiah';
import React from 'react';
import { ClientDecisionClient } from './ClientDecisionClient';

export const metadata = { title: 'Keputusan (RAB) — Arkavena OS' };

export default async function ClientPortalDecisionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const overviewResult = await getClientProjectOverviewAction(projectId);
  if (!overviewResult.ok || overviewResult.data === null) notFound();
  const overview = overviewResult.data;

  const proposal = await getClientProposal(projectId);
  const estimate = proposal?.estimates;
  const items = estimate?.estimate_items || [];

  const groupedItems = items.reduce((acc: any, item: any) => {
    const group = item.group_name || 'Lain-lain';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const grandTotal = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2A2A2A]">
            <FileSignature className="text-gray-400" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{overview.project_name}</h1>
            <p className="text-sm text-gray-500">Persetujuan Rencana Anggaran (RAB)</p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="/decisions" />

      {!proposal && (
        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-12 text-center">
          <p className="text-gray-400">Belum ada dokumen RAB yang diajukan untuk proyek ini.</p>
        </div>
      )}

      {proposal && estimate && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">{estimate.title || 'Rencana Anggaran Pelaksanaan'}</h2>
              <p className="text-sm text-gray-400 mt-1">Berikut adalah rincian anggaran yang diajukan untuk proyek ini.</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse text-gray-300">
                <thead className="bg-[#222] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-3 font-semibold w-12">No.</th>
                    <th className="px-6 py-3 font-semibold min-w-[250px]">Uraian Pekerjaan</th>
                    <th className="px-6 py-3 font-semibold text-right">Volume</th>
                    <th className="px-6 py-3 font-semibold">Sat.</th>
                    <th className="px-6 py-3 font-semibold text-right">Harga Satuan</th>
                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.entries(groupedItems).map(([group, groupItems]: [string, any], groupIdx) => {
                    const groupTotal = groupItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);
                    return (
                      <React.Fragment key={group}>
                        <tr className="bg-white/5">
                          <td className="px-6 py-3 font-semibold">{groupIdx + 1}</td>
                          <td colSpan={4} className="px-6 py-3 font-semibold text-white">{group}</td>
                          <td className="px-6 py-3 font-semibold text-white text-right">{formatRp(toRupiah(groupTotal))}</td>
                        </tr>
                        {groupItems.map((item: any, itemIdx: number) => (
                          <tr key={item.id} className="hover:bg-white/5">
                            <td className="px-6 py-3 text-gray-500">{groupIdx + 1}.{itemIdx + 1}</td>
                            <td className="px-6 py-3 text-gray-300">{item.description}</td>
                            <td className="px-6 py-3 text-right">{Number(item.quantity).toLocaleString('id-ID')}</td>
                            <td className="px-6 py-3">{item.unit}</td>
                            <td className="px-6 py-3 text-right">{formatRp(toRupiah(item.unit_price))}</td>
                            <td className="px-6 py-3 text-right font-medium">
                              {formatRp(toRupiah(Number(item.quantity) * Number(item.unit_price)))}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-[#222] border-t border-white/10">
                    <td colSpan={5} className="px-6 py-4 font-bold text-white text-right">JUMLAH TOTAL</td>
                    <td className="px-6 py-4 font-bold text-white text-right text-lg">{formatRp(toRupiah(grandTotal))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ClientDecisionClient proposalId={proposal.id} status={proposal.status} />
        </div>
      )}
    </div>
  );
}
