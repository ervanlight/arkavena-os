'use client';

import { useState } from 'react';
import { Card, Button } from '@/core/ui';
import { formatRp } from '@/core/money/rupiah';
import { ReviewInboxItem, reviewHoldPointAction, reviewSubconQuoteAction } from '@/modules/review-center';
import { ShieldCheck, Receipt, Building2, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export function ReviewCard({ item }: { item: ReviewInboxItem }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const handleAction = async (decision: string) => {
    setIsSubmitting(true);
    try {
      let result;
      if (item.type === 'hold_point') {
        result = await reviewHoldPointAction({ 
          inspectionId: item.id, 
          decision: decision as any, 
          reason 
        });
      } else if (item.type === 'subcon_quote') {
        result = await reviewSubconQuoteAction({ 
          quoteId: item.id, 
          decision: decision as any, 
          reason 
        });
      }

      if (result && !result.ok) {
        toast.error(result.error.message);
      } else {
        toast.success(`Berhasil memproses ${item.type === 'hold_point' ? 'inspeksi' : 'RAB'}`);
      }
    } catch (e) {
      toast.error('Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const Icon = item.type === 'hold_point' ? ShieldCheck : Receipt;
  const iconColor = item.type === 'hold_point' ? 'text-blue-500' : 'text-yellow-500';

  return (
    <Card className="p-5">
      <div className="flex flex-col md:flex-row gap-5">
        
        {/* Left Icon */}
        <div className="hidden md:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] shadow-sm">
          <Icon size={24} className={iconColor} strokeWidth={1.5} />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-bold tracking-wider uppercase ${iconColor}`}>
                  {item.type === 'hold_point' ? 'Hold Point (Mutu)' : 'RAB Baru'}
                </span>
                <span className="text-xs text-[color:var(--color-ink-tertiary)] flex items-center gap-1">
                  <Calendar size={12} /> {new Date(item.submittedAt).toLocaleDateString('id-ID')}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[color:var(--color-ink)]">{item.title}</h3>
              <p className="text-[15px] text-[color:var(--color-ink-secondary)] mt-0.5 leading-relaxed">{item.subtitle}</p>
            </div>
            
            {item.amountRp !== undefined && item.amountRp !== null && (
              <div className="text-right">
                <p className="text-xs text-[color:var(--color-ink-tertiary)] mb-0.5">Nilai Pengajuan</p>
                <p className="text-lg font-bold text-[color:var(--color-ink)]">{formatRp(item.amountRp)}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-[color:var(--color-hairline)] text-sm text-[color:var(--color-ink-secondary)]">
            <div className="flex items-center gap-1.5">
              <Building2 size={14} className="text-[color:var(--color-ink-tertiary)]" />
              {item.projectName}
            </div>
            {item.zoneName && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-[color:var(--color-ink-tertiary)]" />
                {item.zoneName}
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="shrink-0 w-full md:w-64 flex flex-col justify-end space-y-2 border-t md:border-t-0 md:border-l border-[color:var(--color-hairline)] pt-4 md:pt-0 md:pl-5">
          <textarea
            placeholder="Catatan persetujuan / alasan tolak..."
            className="w-full text-sm p-2 rounded border border-[color:var(--color-hairline)] bg-[color:var(--color-canvas)] h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-[color:var(--color-ink-tertiary)]"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none shadow-none" 
              onClick={() => handleAction(item.type === 'hold_point' ? 'fail' : 'rejected')}
              disabled={isSubmitting}
            >
              Tolak
            </Button>
            <Button 
              className="flex-1 shadow-[var(--shadow-btn)]" 
              onClick={() => handleAction(item.type === 'hold_point' ? 'pass' : 'accepted')}
              disabled={isSubmitting}
            >
              Setujui
            </Button>
          </div>
          {item.type === 'hold_point' && (
            <button 
              className="text-[11px] text-[color:var(--color-ink-tertiary)] hover:text-orange-500 font-medium underline underline-offset-2 transition-colors mt-1"
              onClick={() => handleAction('override')}
              disabled={isSubmitting}
            >
              Override (Technical Director)
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
