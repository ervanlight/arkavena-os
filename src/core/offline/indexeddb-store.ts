import type { OutboxMutation, OutboxStatus, OutboxStore } from './types';

const DB_NAME = 'siteflow-outbox';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open outbox database'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Outbox database request failed'));
  });
}

/**
 * IndexedDB-backed OutboxStore -- what the app actually runs on. Kept behind
 * the OutboxStore interface (types.ts) so outbox.ts's own logic (retry
 * counting, FIFO ordering, per-mutation failure isolation) has a real
 * Vitest unit test against a plain in-memory fake instead: this file's own
 * job is just the mechanical IndexedDB translation, with the real proof of
 * correctness coming from a real browser (Playwright, and the CHECKPOINT #3
 * real-device test), not a fake-IndexedDB shim added purely for unit
 * coverage of code this thin.
 */
export const indexedDbOutboxStore: OutboxStore = {
  async add(mutation) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(mutation);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to add outbox mutation'));
      });
    } finally {
      db.close();
    }
  },

  async listByStatus(status: OutboxStatus) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('by-status');
      return await requestToPromise(index.getAll(status) as IDBRequest<OutboxMutation[]>);
    } finally {
      db.close();
    }
  },

  async update(mutation) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(mutation);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to update outbox mutation'));
      });
    } finally {
      db.close();
    }
  },

  async remove(id: string) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to remove outbox mutation'));
      });
    } finally {
      db.close();
    }
  },
};
