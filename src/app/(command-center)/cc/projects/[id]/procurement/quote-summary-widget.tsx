'use client';

import { useState } from 'react';
import { generateQuoteSummaryAction, type QuoteSummaryResult } from '@/modules/ai-scribe';
import { Button } from '@/core/ui';

type WidgetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: QuoteSummaryResult }
  | { status: 'error'; message: string };

/** Purely informational -- never writes to vendor_quotes, nothing here to save (ADR 0020 SS6). */
export function QuoteSummaryWidget({ vendorQuoteId }: { vendorQuoteId: string }) {
  const [state, setState] = useState<WidgetState>({ status: 'idle' });

  async function handleCompare() {
    setState({ status: 'loading' });
    const result = await generateQuoteSummaryAction({ vendorQuoteId });
    if (!result.ok) {
      setState({ status: 'error', message: result.error.message });
      return;
    }
    setState({ status: 'done', result: result.data });
  }

  return (
    <div>
      <Button type="button" variant="secondary" size="sm" onClick={handleCompare} disabled={state.status === 'loading'}>
        {state.status === 'loading' ? 'Membandingkan...' : 'Bandingkan (AI)'}
      </Button>
      {state.status === 'done' && (
        <div className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--color-surface-secondary)] p-3 text-xs text-[color:var(--color-ink-secondary)]">
          <p>{state.result.summary}</p>
          <ul className="mt-1 list-inside list-disc">
            {state.result.quotes.map((q, i) => (
              <li key={i}>
                {q.vendorName}: {q.description} — {q.amount}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.status === 'error' && (
        <p role="alert" className="mt-1 text-xs text-[color:var(--color-danger)]">
          {state.message}
        </p>
      )}
    </div>
  );
}
