import { Loader2 } from 'lucide-react';

export default function CommandCenterLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--color-accent)]" />
        <p className="text-sm font-medium text-[color:var(--color-ink-secondary)]">Memuat data...</p>
      </div>
    </div>
  );
}
