import type { ReactNode } from 'react';
import { cn } from './cn';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-[color:var(--color-ink-tertiary)]/12 text-[color:var(--color-ink-secondary)]',
  success: 'bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]',
  warning: 'bg-[color:var(--color-warning)]/14 text-[#a05a00]',
  danger: 'bg-[color:var(--color-danger)]/12 text-[color:var(--color-danger)]',
  info: 'bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent-hover)]',
};

/** A pill-shaped status indicator -- the one place status colouring is decided, so every page reads the same "green means done" language (CLAUDE.md 12: single source of truth over per-page ad hoc colour choices). */
export function StatusBadge({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}
