export type OutboxOperation = 'create' | 'update';
export type OutboxStatus = 'pending' | 'syncing' | 'failed';

/**
 * One field-level mutation (D3, ARCHITECTURE.md §9): `fields` is a partial
 * patch, never a full row snapshot. Sync applies only the columns actually
 * touched, so two mutations against the same row that touch different
 * fields never clobber each other -- the "last write wins" in D3's name is
 * scoped to a single field, not the whole record. `entityId` is always
 * client-generated (crypto.randomUUID()), including for 'create': that is
 * what lets a retry after a network failure re-send the exact same create
 * idempotently (the server action upserts by this id) instead of risking a
 * duplicate row, and lets the UI reference an entity that only exists
 * locally so far.
 */
export type OutboxMutation = {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: OutboxOperation;
  readonly fields: Record<string, unknown>;
  readonly createdAt: number;
  readonly status: OutboxStatus;
  readonly retryCount: number;
  readonly lastError: string | null;
};

export type NewOutboxMutation = {
  entityType: string;
  entityId: string;
  operation: OutboxOperation;
  fields: Record<string, unknown>;
};

/**
 * Storage backend the orchestration in outbox.ts runs against -- IndexedDB
 * in the browser (indexeddb-store.ts), an in-memory fake in tests. Neither
 * Node nor jsdom implement IndexedDB, so keeping this behind an interface is
 * what lets enqueue/drain's actual logic (retry counting, FIFO order,
 * per-mutation failure handling) get a real Vitest unit test instead of
 * either skipping coverage or pulling in a shim library for it.
 */
export interface OutboxStore {
  add(mutation: OutboxMutation): Promise<void>;
  listByStatus(status: OutboxStatus): Promise<OutboxMutation[]>;
  update(mutation: OutboxMutation): Promise<void>;
  remove(id: string): Promise<void>;
}

export type SyncResult = { ok: true } | { ok: false; error: string };

/** Translates one queued mutation into the real server action call for its entityType. */
export type SyncHandler = (mutation: OutboxMutation) => Promise<SyncResult>;
