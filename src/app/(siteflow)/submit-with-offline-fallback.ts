'use client';

import { enqueueMutation } from '@/core/offline/outbox';
import { indexedDbOutboxStore } from '@/core/offline/indexeddb-store';
import type { ActionResult } from '@/core/errors/handle';

export type OfflineFallbackResult<T> =
  | { status: 'online'; data: T }
  | { status: 'offline' }
  | { status: 'error'; message: string };

/**
 * The shared "try it live, fall back to the outbox" shape every six-button
 * form uses. A server action called with no connectivity does not resolve
 * to `{ ok: false }` -- the fetch itself throws, before the server ever
 * sees the request -- so a real network failure is only ever visible here
 * as a thrown exception, never as an ActionResult. That is the one
 * condition this queues; an ActionResult with `ok: false` is a real
 * rejection (validation, permission) and must surface as an error, not
 * silently queue a mutation that will just fail the same way again on sync.
 *
 * `input` must include the caller-generated `id` every create schema in
 * modules/field-reporting requires (FR6) -- it becomes the mutation's
 * `entityId`, and everything else becomes the field patch OutboxSync's
 * handlers reconstruct `{ id: mutation.entityId, ...mutation.fields }` from.
 */
export async function submitOrQueueOffline<TInput extends { id: string }, TOutput>(
  entityType: string,
  input: TInput,
  action: (input: TInput) => Promise<ActionResult<TOutput>>,
): Promise<OfflineFallbackResult<TOutput>> {
  try {
    const result = await action(input);
    if (!result.ok) return { status: 'error', message: result.error.message };
    return { status: 'online', data: result.data };
  } catch {
    const { id, ...fields } = input;
    await enqueueMutation(indexedDbOutboxStore, { entityType, entityId: id, operation: 'create', fields });
    return { status: 'offline' };
  }
}
