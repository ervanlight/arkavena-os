import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[color:var(--color-hairline)] px-6 py-14 text-center">
      <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{title}</p>
      {description !== undefined && (
        <p className="mt-1 max-w-sm text-sm text-[color:var(--color-ink-secondary)]">{description}</p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}
