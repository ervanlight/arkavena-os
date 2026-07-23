'use client';

import { useState } from 'react';
import { generateQuoteSummaryAction, type QuoteSummaryResult } from '@/modules/ai-scribe';

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
      <button
        type="button"
        onClick={handleCompare}
        disabled={state.status === 'loading'}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
      >
        {state.status === 'loading' ? 'Membandingkan...' : 'Bandingkan (AI)'}
      </button>
      {state.status === 'done' && (
        <div className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
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
        <p role="alert" className="mt-1 text-xs text-red-600">
          {state.message}
        </p>
      )}
    </div>
  );
}
