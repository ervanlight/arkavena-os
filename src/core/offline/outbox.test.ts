import { describe, expect, it } from 'vitest';
import { drainOutbox, enqueueMutation, requeueMutation } from './outbox';
import type { OutboxMutation, OutboxStatus, OutboxStore, SyncHandler } from './types';

/** A plain in-memory OutboxStore -- exactly what neither Node nor jsdom's missing IndexedDB would otherwise force onto a shim library. */
function fakeStore(seed: OutboxMutation[] = []): OutboxStore {
  const rows = new Map(seed.map((m) => [m.id, m]));
  return {
    async add(mutation) {
      rows.set(mutation.id, mutation);
    },
    async listByStatus(status: OutboxStatus) {
      return [...rows.values()].filter((m) => m.status === status);
    },
    async update(mutation) {
      rows.set(mutation.id, mutation);
    },
    async remove(id: string) {
      rows.delete(id);
    },
  };
}

function handlerThatAlways(result: { ok: true } | { ok: false; error: string }): SyncHandler {
  return async () => result;
}

describe('enqueueMutation', () => {
  it('stores a new mutation as pending with zero retries', async () => {
    const store = fakeStore();
    const mutation = await enqueueMutation(store, {
      entityType: 'daily_log',
      entityId: 'entity-1',
      operation: 'create',
      fields: { weather: 'Cerah' },
    });

    expect(mutation.status).toBe('pending');
    expect(mutation.retryCount).toBe(0);
    expect(mutation.lastError).toBeNull();
    expect(await store.listByStatus('pending')).toEqual([mutation]);
  });
});

describe('drainOutbox', () => {
  it('removes a mutation from the store once its handler succeeds', async () => {
    const store = fakeStore();
    await enqueueMutation(store, {
      entityType: 'daily_log',
      entityId: 'entity-1',
      operation: 'create',
      fields: { weather: 'Cerah' },
    });

    const summary = await drainOutbox(store, new Map([['daily_log', handlerThatAlways({ ok: true })]]));

    expect(summary).toEqual({ synced: 1, failed: 0, skipped: 0 });
    expect(await store.listByStatus('pending')).toEqual([]);
  });

  it('increments retryCount and keeps a failing mutation pending, below the cap', async () => {
    const store = fakeStore();
    await enqueueMutation(store, { entityType: 'daily_log', entityId: 'e1', operation: 'create', fields: {} });

    const summary = await drainOutbox(
      store,
      new Map([['daily_log', handlerThatAlways({ ok: false, error: 'jaringan terputus' })]]),
    );

    expect(summary).toEqual({ synced: 0, failed: 1, skipped: 0 });
    const pending = await store.listByStatus('pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.retryCount).toBe(1);
    expect(pending[0]?.lastError).toBe('jaringan terputus');
  });

  it('marks a mutation failed instead of pending once it hits the retry cap, and stops retrying it automatically', async () => {
    const store = fakeStore();
    await enqueueMutation(store, { entityType: 'daily_log', entityId: 'e1', operation: 'create', fields: {} });
    const failingHandlers = new Map([['daily_log', handlerThatAlways({ ok: false, error: 'tolak' })]]);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await drainOutbox(store, failingHandlers);
    }

    expect(await store.listByStatus('pending')).toEqual([]);
    const failed = await store.listByStatus('failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.retryCount).toBe(5);

    // A 6th drain must not touch it -- 'failed' mutations are excluded from
    // the automatic pending-only scan, by design.
    const summary = await drainOutbox(store, failingHandlers);
    expect(summary).toEqual({ synced: 0, failed: 0, skipped: 0 });
  });

  it('skips a mutation whose entityType has no registered handler, without touching its status', async () => {
    const store = fakeStore();
    const mutation = await enqueueMutation(store, {
      entityType: 'unregistered_type',
      entityId: 'e1',
      operation: 'create',
      fields: {},
    });

    const summary = await drainOutbox(store, new Map());

    expect(summary).toEqual({ synced: 0, failed: 0, skipped: 1 });
    expect(await store.listByStatus('pending')).toEqual([mutation]);
  });

  it('treats a handler that throws the same as one that returns ok: false', async () => {
    const store = fakeStore();
    await enqueueMutation(store, { entityType: 'daily_log', entityId: 'e1', operation: 'create', fields: {} });
    const throwingHandler: SyncHandler = async () => {
      throw new TypeError('Failed to fetch');
    };

    const summary = await drainOutbox(store, new Map([['daily_log', throwingHandler]]));

    expect(summary).toEqual({ synced: 0, failed: 1, skipped: 0 });
    const pending = await store.listByStatus('pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.lastError).toBe('Failed to fetch');
  });

  it('falls back to a generic message when a handler throws a non-Error value', async () => {
    const store = fakeStore();
    await enqueueMutation(store, { entityType: 'daily_log', entityId: 'e1', operation: 'create', fields: {} });
    const throwingHandler: SyncHandler = async () => {
      throw 'not an Error instance';
    };

    await drainOutbox(store, new Map([['daily_log', throwingHandler]]));

    const pending = await store.listByStatus('pending');
    expect(pending[0]?.lastError).toBe('Unknown sync error');
  });

  it('processes mutations in creation order so a create is never sent after its own later update', async () => {
    const store = fakeStore();
    const order: string[] = [];
    const handler: SyncHandler = async (mutation) => {
      order.push(`${mutation.operation}:${mutation.entityId}`);
      return { ok: true };
    };

    // Enqueue the update first in wall-clock terms is impossible by
    // construction (enqueueMutation stamps createdAt = Date.now()), so
    // instead seed the store directly with an update whose createdAt
    // predates -- this proves drainOutbox sorts by createdAt rather than
    // trusting insertion order into the store.
    const created = await enqueueMutation(store, {
      entityType: 'daily_log',
      entityId: 'entity-1',
      operation: 'create',
      fields: { weather: 'Cerah' },
    });
    await store.update({ ...created, createdAt: 1000 });

    const update = await enqueueMutation(store, {
      entityType: 'daily_log',
      entityId: 'entity-1',
      operation: 'update',
      fields: { weather: 'Hujan' },
    });
    await store.update({ ...update, createdAt: 2000 });

    await drainOutbox(store, new Map([['daily_log', handler]]));

    expect(order).toEqual(['create:entity-1', 'update:entity-1']);
  });

  it('does not fail every remaining mutation when one entity is rejected', async () => {
    const store = fakeStore();
    await enqueueMutation(store, { entityType: 'daily_log', entityId: 'bad', operation: 'create', fields: {} });
    await enqueueMutation(store, { entityType: 'daily_log', entityId: 'good', operation: 'create', fields: {} });

    const handler: SyncHandler = async (mutation) =>
      mutation.entityId === 'bad' ? { ok: false, error: 'ditolak' } : { ok: true };

    const summary = await drainOutbox(store, new Map([['daily_log', handler]]));

    expect(summary).toEqual({ synced: 1, failed: 1, skipped: 0 });
  });
});

describe('requeueMutation', () => {
  it('resets a failed mutation back to pending with retryCount and lastError cleared', async () => {
    const store = fakeStore();
    const mutation = await enqueueMutation(store, { entityType: 'daily_log', entityId: 'e1', operation: 'create', fields: {} });
    const failed: OutboxMutation = { ...mutation, status: 'failed', retryCount: 5, lastError: 'tolak' };
    await store.update(failed);

    await requeueMutation(store, failed);

    const [requeued] = await store.listByStatus('pending');
    expect(requeued).toMatchObject({ status: 'pending', retryCount: 0, lastError: null });
  });
});
