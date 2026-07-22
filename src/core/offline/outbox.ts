import type { NewOutboxMutation, OutboxMutation, OutboxStore, SyncHandler } from './types';

/**
 * After this many failed attempts a mutation stops being retried
 * automatically and sits as 'failed' until a person explicitly re-queues
 * it. Without a cap, a mutation that can never succeed (a genuine
 * validation rejection, not a network blip) would retry forever every time
 * connectivity returns -- D3 deliberately has no conflict resolution
 * cleverness, so surfacing "this one needs a human" beats guessing.
 */
const MAX_RETRIES = 5;

export async function enqueueMutation(store: OutboxStore, input: NewOutboxMutation): Promise<OutboxMutation> {
  const mutation: OutboxMutation = {
    id: crypto.randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    fields: input.fields,
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
    lastError: null,
  };
  await store.add(mutation);
  return mutation;
}

export type DrainSummary = { synced: number; failed: number; skipped: number };

/**
 * Replays every 'pending' mutation, in creation order, against its
 * registered handler.
 *
 * FIFO matters here: a project-role-only user creates a daily log, then
 * edits it, both offline. If the edit's mutation somehow ran before the
 * create's, it would target a row that does not exist yet. Ordering by
 * createdAt keeps a create ahead of any update queued after it.
 *
 * A failing mutation does not block the rest of the queue -- entities are
 * independent, and one entity's rejected mutation has no bearing on
 * whether an unrelated one can sync. It only affects its own retry count.
 * 'failed' mutations (retryCount already at the cap) are deliberately left
 * out of automatic drains; they need an explicit person-driven re-queue.
 */
export async function drainOutbox(store: OutboxStore, handlers: ReadonlyMap<string, SyncHandler>): Promise<DrainSummary> {
  const pending = (await store.listByStatus('pending')).slice().sort((a, b) => a.createdAt - b.createdAt);

  const summary: DrainSummary = { synced: 0, failed: 0, skipped: 0 };

  for (const mutation of pending) {
    const handler = handlers.get(mutation.entityType);
    if (handler === undefined) {
      summary.skipped += 1;
      continue;
    }

    await store.update({ ...mutation, status: 'syncing' });

    let result;
    try {
      result = await handler(mutation);
    } catch (error) {
      result = { ok: false as const, error: error instanceof Error ? error.message : 'Unknown sync error' };
    }

    if (result.ok) {
      await store.remove(mutation.id);
      summary.synced += 1;
      continue;
    }

    const retryCount = mutation.retryCount + 1;
    await store.update({
      ...mutation,
      status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
      retryCount,
      lastError: result.error,
    });
    summary.failed += 1;
  }

  return summary;
}

/** Moves a 'failed' mutation back to 'pending' with its retry count reset -- the explicit re-queue drainOutbox's own doc comment requires. */
export async function requeueMutation(store: OutboxStore, mutation: OutboxMutation): Promise<void> {
  await store.update({ ...mutation, status: 'pending', retryCount: 0, lastError: null });
}
