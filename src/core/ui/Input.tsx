import type { InputHTMLAttributes, LabelHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const FIELD_CLASSES =
  'w-full rounded-[var(--radius-control)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3.5 py-2.5 text-[15px] text-[color:var(--color-ink)] shadow-sm transition-shadow placeholder:text-[color:var(--color-ink-tertiary)] focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--color-accent)]/15';

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Select({
  className,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-[color:var(--color-ink-secondary)]', className)} {...props} />;
}
