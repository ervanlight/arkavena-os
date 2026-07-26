'use client';

import { useState } from 'react';
import type { ReviewInboxItem } from '@/modules/review-center/types';
import { ReviewCard } from './review-card';

export function InboxList({ initialItems }: { initialItems: ReviewInboxItem[] }) {
  const [filter, setFilter] = useState<'all' | 'hold_point' | 'subcon_quote'>('all');
  
  const filteredItems = filter === 'all' 
    ? initialItems 
    : initialItems.filter(item => item.type === filter);

  const holdPointCount = initialItems.filter(i => i.type === 'hold_point').length;
  const quoteCount = initialItems.filter(i => i.type === 'subcon_quote').length;

  return (
    <div className="space-y-6">
      <div className="flex border-b border-[color:var(--color-hairline)]">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]'
          }`}
        >
          Semua Pengajuan ({initialItems.length})
        </button>
        <button
          onClick={() => setFilter('hold_point')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            filter === 'hold_point' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]'
          }`}
        >
          Persetujuan Mutu ({holdPointCount})
        </button>
        <button
          onClick={() => setFilter('subcon_quote')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            filter === 'subcon_quote' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink)]'
          }`}
        >
          RAB Subkontraktor ({quoteCount})
        </button>
      </div>

      <div className="space-y-4">
        {filteredItems.map(item => (
          <ReviewCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
