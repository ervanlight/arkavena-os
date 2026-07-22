'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once, on mount, for the whole app -- not just
 * (siteflow). A service worker registered at the root scope ('/') covers
 * every route, and installability (Chrome's own criteria) needs one
 * present regardless of which page the user happens to load first.
 */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort. A failed registration means no offline fallback page
      // and no install prompt -- degraded, not broken, since the app's own
      // outbox (D3) is what actually carries offline capability.
    });
  }, []);

  return null;
}
