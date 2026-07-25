'use client';

import { useState } from 'react';
import { generateDelayDetectionAction, type DelayDetectionResult } from '@/modules/ai-scribe';
import { Card, Button } from '@/core/ui';

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
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Deteksi keterlambatan (AI)</h2>
        <Button type="button" variant="secondary" size="sm" onClick={handleCheck} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Memeriksa...' : 'Periksa termin'}
        </Button>
      </div>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.message}
        </p>
      )}

      {state.status === 'done' && state.result.overdueMilestones.length === 0 && (
        <p className="text-sm text-[color:var(--color-success)]">Tidak ada termin yang terlambat.</p>
      )}

      {state.status === 'done' && state.result.overdueMilestones.length > 0 && (
        <div className="space-y-2">
          {state.result.draftSummary !== null && (
            <p className="rounded-[var(--radius-control)] bg-[color:var(--color-warning)]/14 px-3 py-2 text-sm text-[#a05a00]">
              {state.result.draftSummary}
            </p>
          )}
          <ul className="list-inside list-disc text-sm text-[color:var(--color-ink-secondary)]">
            {state.result.overdueMilestones.map((milestone) => (
              <li key={milestone.id}>
                {milestone.name} — terlambat {milestone.daysOverdue} hari
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
