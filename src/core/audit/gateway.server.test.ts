import { describe, expect, it, vi } from 'vitest';
import type { ServerSupabase } from '@/core/db/client.server';
import { createAuditGateway } from './gateway.server';

/**
 * Regression for the same bug audit.test.ts's diffRows cases cover: even
 * once diffRows stops throwing on a bigint field, the raw bigint still has
 * to cross `.rpc()`'s own JSON serialisation to reach fn_record_audit --
 * `createAuditGateway` is the one place that conversion has to happen
 * (CLAUDE.md law 0.1 keeps money as bigint everywhere else).
 */
function fakeSupabase(rpc: ReturnType<typeof vi.fn>): ServerSupabase {
  return { rpc } as unknown as ServerSupabase;
}

describe('createAuditGateway', () => {
  it('converts a bigint newValue field to a string before calling fn_record_audit', async () => {
    const rpc = vi.fn(async () => ({ data: 'audit-id', error: null }));
    const gateway = createAuditGateway(fakeSupabase(rpc));

    await gateway.write({
      entityTable: 'leads',
      entityId: 'lead-1',
      action: 'insert',
      previousValue: {},
      newValue: { id: 'lead-1', estimated_value: 750_000_000n },
      reason: null,
      requestId: null,
      projectId: null,
    });

    expect(rpc).toHaveBeenCalledWith(
      'fn_record_audit',
      expect.objectContaining({
        p_new: { id: 'lead-1', estimated_value: '750000000' },
      }),
    );
  });

  it('converts a bigint nested inside an array or object', async () => {
    const rpc = vi.fn(async () => ({ data: 'audit-id', error: null }));
    const gateway = createAuditGateway(fakeSupabase(rpc));

    await gateway.write({
      entityTable: 'estimate_items',
      entityId: 'item-1',
      action: 'update',
      previousValue: { unit_cost: 100_000n },
      newValue: { unit_cost: 120_000n, tags: ['a', { amount: 5_000n }] },
      reason: null,
      requestId: null,
      projectId: null,
    });

    expect(rpc).toHaveBeenCalledWith(
      'fn_record_audit',
      expect.objectContaining({
        p_previous: { unit_cost: '100000' },
        p_new: { unit_cost: '120000', tags: ['a', { amount: '5000' }] },
      }),
    );
  });
});
