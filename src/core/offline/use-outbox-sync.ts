'use client';

import { useEffect, useRef } from 'react';
import { drainOutbox } from './outbox';
import { indexedDbOutboxStore } from './indexeddb-store';
import type { SyncHandler } from './types';

const RETRY_INTERVAL_MS = 20_000;

/**
 * Triggers an outbox drain whenever the app might plausibly have regained
 * connectivity: on mount, on the browser's own `online` event, and when the
 * tab becomes visible again -- mobile Safari/Chrome do not reliably fire
 * `online` right after airplane mode toggles off, but foregrounding the tab
 * is the one signal that consistently follows. A periodic timer is the
 * backstop for the case neither fires while the tab stays open.
 *
 * No Background Sync API: iOS Safari has never implemented it, and this
 * app is already committed (FR3) to working fully from a plain browser
 * tab, not just an installed one -- a sync mechanism that only worked
 * "installed" would contradict that.
 */
export function useOutboxSync(handlers: ReadonlyMap<string, SyncHandler>): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;

    async function attemptDrain() {
      if (cancelled || !navigator.onLine) return;
      await drainOutbox(indexedDbOutboxStore, handlersRef.current);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void attemptDrain();
    }

    void attemptDrain();

    window.addEventListener('online', attemptDrain);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(attemptDrain, RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener('online', attemptDrain);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, []);
}
