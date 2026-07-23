import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** The base surface every grouped content block in this redesign sits on -- a soft-shadowed, continuous-radius card, not a hard-bordered box. */
export function Card({ className, interactive = false, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-[color:var(--color-surface)] p-5 shadow-[var(--shadow-card)]',
        interactive && 'transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-center justify-between', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[17px] font-semibold text-[color:var(--color-ink)]', className)} {...props} />;
}
