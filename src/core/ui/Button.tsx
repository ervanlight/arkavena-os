import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'md' | 'sm';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)] active:opacity-90',
  secondary:
    'bg-[color:var(--color-surface-secondary)] text-[color:var(--color-ink)] hover:brightness-95 active:brightness-90 border border-[color:var(--color-hairline)]',
  ghost: 'bg-transparent text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10',
  destructive: 'bg-[color:var(--color-danger)] text-white hover:brightness-95 active:brightness-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'px-4 py-2.5 text-[15px]',
  sm: 'px-3 py-1.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
