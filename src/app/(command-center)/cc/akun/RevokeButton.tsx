'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { revokeProjectAccessAction } from '@/modules/access-management/actions';

interface Props {
  memberId: string;
  projectName: string;
  userName: string;
}

export function RevokeButton({ memberId, projectName, userName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleRevoke() {
    setIsPending(true);
    const result = await revokeProjectAccessAction({ memberId });
    setIsPending(false);
    if (result.ok) {
      setConfirming(false);
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[color:var(--color-danger)]">
          Cabut {userName} dari {projectName}?
        </span>
        <button
          onClick={handleRevoke}
          disabled={isPending}
          className="rounded px-2 py-0.5 text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >
          {isPending ? '...' : 'Cabut'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-[color:var(--color-ink-secondary)]">
          Batal
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Cabut akses"
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--color-ink-tertiary)] hover:bg-red-50 hover:text-red-500 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
