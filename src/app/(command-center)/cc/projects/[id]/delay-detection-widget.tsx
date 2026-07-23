'use client';

import { useState } from 'react';
import { generateDelayDetectionAction, type DelayDetectionResult } from '@/modules/ai-scribe';

type WidgetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: DelayDetectionResult }
  | { status: 'error'; message: string };

/**
 * Button-triggered, not automatic on page load (ADR 0020 SS4) -- every click
 * is a real Claude API call once something is actually overdue, so this
 * never runs without a person asking for it.
 */
export function DelayDetectionWidget({ projectId }: { projectId: string }) {
  const [state, setState] = useState<WidgetState>({ status: 'idle' });

  async function handleCheck() {
    setState({ status: 'loading' });
    const result = await generateDelayDetectionAction({ projectId });

    if (!result.ok) {
      setState({ status: 'error', message: result.error.message });
      return;
    }

    setState({ status: 'done', result: result.data });
  }

  return (
    <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Deteksi keterlambatan (AI)</h2>
        <button
          type="button"
          onClick={handleCheck}
          disabled={state.status === 'loading'}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {state.status === 'loading' ? 'Memeriksa...' : 'Periksa termin'}
        </button>
      </div>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      {state.status === 'done' && state.result.overdueMilestones.length === 0 && (
        <p className="text-sm text-emerald-600">Tidak ada termin yang terlambat.</p>
      )}

      {state.status === 'done' && state.result.overdueMilestones.length > 0 && (
        <div className="space-y-2">
          {state.result.draftSummary !== null && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{state.result.draftSummary}</p>
          )}
          <ul className="list-inside list-disc text-sm text-slate-700">
            {state.result.overdueMilestones.map((milestone) => (
              <li key={milestone.id}>
                {milestone.name} — terlambat {milestone.daysOverdue} hari
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
