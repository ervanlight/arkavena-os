import { describe, expect, it, vi } from 'vitest';
import { AuditReasonRequiredError } from '@/core/errors/app-error';
import { diffRows, recordAudit, withAudit } from './audit';
import type { AuditGateway } from './types';

function fakeGateway(): AuditGateway & { calls: Parameters<AuditGateway['write']>[0][] } {
  const calls: Parameters<AuditGateway['write']>[0][] = [];
  return {
    calls,
    write: vi.fn(async (entry) => {
      calls.push(entry);
      return 'audit-id';
    }),
  };
}

describe('diffRows', () => {
  it('keeps only the columns that actually changed', () => {
    const { previousValue, newValue } = diffRows(
      { id: '1', status: 'draft', amount: '5000', title: 'Sama' },
      { id: '1', status: 'under_review', amount: '5000', title: 'Sama' },
    );

    expect(previousValue).toEqual({ status: 'draft' });
    expect(newValue).toEqual({ status: 'under_review' });
  });

  it('ignores updated_at, which changes on every write', () => {
    const { previousValue, newValue } = diffRows(
      { id: '1', status: 'draft', updated_at: '2026-07-20T00:00:00Z' },
      { id: '1', status: 'draft', updated_at: '2026-07-20T09:00:00Z' },
    );

    expect(previousValue).toEqual({});
    expect(newValue).toEqual({});
  });

  it('records an insert as an empty previous value', () => {
    const { previousValue, newValue } = diffRows(undefined, { id: '1', status: 'draft' });

    expect(previousValue).toEqual({ id: undefined, status: undefined });
    expect(newValue).toEqual({ id: '1', status: 'draft' });
  });

  /**
   * Regression: every Rupiah money column is a raw bigint (CLAUDE.md 0.1),
   * and the old equality check ran every changed value through
   * `JSON.stringify` as a deep-equality fallback -- which throws
   * `TypeError: Do not know how to serialize a BigInt`. Caught by actually
   * clicking through a new lead form with an estimated value in a browser
   * (crm.createLead), not by any existing test, since nothing here had
   * exercised an insert with a changed bigint field before.
   */
  it('diffs a changed bigint field without throwing', () => {
    const { previousValue, newValue } = diffRows(undefined, { id: '1', estimated_value: 750_000_000n });

    expect(previousValue).toEqual({ id: undefined, estimated_value: undefined });
    expect(newValue).toEqual({ id: '1', estimated_value: 750_000_000n });
  });

  it('does not flag an unchanged bigint field as a diff', () => {
    const { previousValue, newValue } = diffRows(
      { id: '1', amount: 5_000_000n },
      { id: '1', amount: 5_000_000n },
    );

    expect(previousValue).toEqual({});
    expect(newValue).toEqual({});
  });
});

describe('recordAudit', () => {
  it('records an ordinary update without needing a reason', async () => {
    const gateway = fakeGateway();

    await recordAudit(gateway, {
      entityTable: 'users',
      entityId: 'u1',
      action: 'update',
      previousValue: { full_name: 'Lama' },
      newValue: { full_name: 'Baru' },
    });

    expect(gateway.calls[0]).toMatchObject({
      entityTable: 'users',
      action: 'update',
      previousValue: { full_name: 'Lama' },
      newValue: { full_name: 'Baru' },
      reason: null,
    });
  });

  it('rejects an override whose reason is present but blank', async () => {
    const gateway = fakeGateway();

    // The type system requires the property; only a runtime check can catch
    // whitespace, which is exactly how a mandatory field gets defeated.
    await expect(
      recordAudit(gateway, {
        entityTable: 'purchase_orders',
        entityId: 'po1',
        action: 'override',
        reason: '   ',
      }),
    ).rejects.toBeInstanceOf(AuditReasonRequiredError);

    expect(gateway.calls).toHaveLength(0);
  });

  it('rejects an approval with a blank reason', async () => {
    const gateway = fakeGateway();

    await expect(
      recordAudit(gateway, {
        entityTable: 'change_orders',
        entityId: 'co1',
        action: 'approve',
        reason: '',
      }),
    ).rejects.toBeInstanceOf(AuditReasonRequiredError);
  });

  it('trims the reason it stores', async () => {
    const gateway = fakeGateway();

    await recordAudit(gateway, {
      entityTable: 'purchase_orders',
      entityId: 'po1',
      action: 'override',
      reason: '  Kas termin sudah cair, bukti transfer menyusul  ',
      requestId: 'req-1',
      projectId: 'p1',
    });

    expect(gateway.calls[0]).toMatchObject({
      reason: 'Kas termin sudah cair, bukti transfer menyusul',
      requestId: 'req-1',
      projectId: 'p1',
    });
  });

  it('will not compile an override without a reason', () => {
    const gateway = fakeGateway();

    // The directive is the assertion. If the conditional type in AuditEntry
    // ever stopped requiring a reason, @ts-expect-error would become an unused
    // suppression and typecheck would fail -- so this test protects the rule
    // even though it asserts nothing at runtime.
    function typeLevelCheck(): void {
      // @ts-expect-error -- 'reason' is required for the 'override' action.
      void recordAudit(gateway, { entityTable: 'purchase_orders', entityId: 'po1', action: 'override' });
    }

    expect(typeof typeLevelCheck).toBe('function');
  });
});

describe('withAudit', () => {
  it('runs the operation, then records the entry', async () => {
    const gateway = fakeGateway();
    const order: string[] = [];

    const result = await withAudit(
      gateway,
      { entityTable: 'users', entityId: 'u1', action: 'update', newValue: { status: 'active' } },
      async () => {
        order.push('operation');
        return 'done';
      },
    );

    order.push('after');
    expect(result).toBe('done');
    expect(gateway.calls).toHaveLength(1);
    expect(order).toEqual(['operation', 'after']);
  });

  it('does not audit an operation that failed', async () => {
    const gateway = fakeGateway();

    await expect(
      withAudit(gateway, { entityTable: 'users', entityId: 'u1', action: 'update' }, async () => {
        throw new Error('constraint violation');
      }),
    ).rejects.toThrow('constraint violation');

    expect(gateway.calls).toHaveLength(0);
  });

  it('surfaces an audit failure rather than swallowing it', async () => {
    // A mutation that happened with no trail is exactly the situation this
    // system exists to prevent, so it must be loud.
    const gateway: AuditGateway = {
      write: vi.fn(async () => {
        throw new Error('audit table unreachable');
      }),
    };

    await expect(
      withAudit(gateway, { entityTable: 'users', entityId: 'u1', action: 'update' }, async () => 'ok'),
    ).rejects.toThrow('audit table unreachable');
  });
});
