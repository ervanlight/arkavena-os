import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | null | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[color:var(--color-ink)]">{title}</h1>
        {subtitle !== undefined && subtitle !== null && (
          <p className="mt-1 text-[15px] text-[color:var(--color-ink-secondary)]">{subtitle}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
