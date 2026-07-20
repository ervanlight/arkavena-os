import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ERROR_CODES } from '@/core/errors/codes';
import { NotFoundError } from '@/core/errors/app-error';
import type { ActionContext } from '@/core/permissions/guard';
import { safeAction } from './safe-action';

const ownerContext: ActionContext = {
  userId: 'u1',
  organizationId: 'org1',
  orgRole: 'owner',
  requestId: 'req1',
};

const financeContext: ActionContext = { ...ownerContext, orgRole: 'finance' };

beforeEach(() => {
  // safeAction logs on every path; keep the test output readable.
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeAction', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('validates, checks permission, then runs the handler', async () => {
    const handler = vi.fn(async (input: { name: string }) => `hello ${input.name}`);

    const action = safeAction(
      {
        name: 'test.greet',
        schema,
        permission: { resource: 'organization', action: 'update' },
        loadContext: async () => ownerContext,
      },
      handler,
    );

    const result = await action({ name: 'Budi' });

    expect(result).toEqual({ ok: true, data: 'hello Budi' });
    expect(handler).toHaveBeenCalledWith({ name: 'Budi' }, ownerContext);
  });

  it('rejects invalid input before the handler runs at all', async () => {
    const handler = vi.fn();

    const action = safeAction(
      { name: 'test.greet', schema, loadContext: async () => ownerContext },
      handler,
    );

    const result = await action({ name: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(result.error.field).toBe('name');
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a disallowed role before the handler runs', async () => {
    const handler = vi.fn();

    const action = safeAction(
      {
        name: 'test.updateOrg',
        schema,
        permission: { resource: 'organization', action: 'update' },
        loadContext: async () => financeContext,
      },
      handler,
    );

    const result = await action({ name: 'Budi' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated caller even with no permission declared', async () => {
    const handler = vi.fn();

    const action = safeAction(
      { name: 'test.open', schema, loadContext: async () => null },
      handler,
    );

    const result = await action({ name: 'Budi' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ERROR_CODES.UNAUTHENTICATED);
    expect(handler).not.toHaveBeenCalled();
  });

  it('never returns the technical message of an unexpected error', async () => {
    // This is the leak this wrapper exists to prevent: a Supabase error names
    // tables and columns, and a client portal user must not see them.
    const action = safeAction(
      { name: 'test.explode', schema, loadContext: async () => ownerContext },
      async () => {
        throw new Error('relation "public.estimates" does not exist, column margin_amount');
      },
    );

    const result = await action({ name: 'Budi' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(result.error.message).not.toContain('estimates');
      expect(result.error.message).not.toContain('margin_amount');
      expect(result.error.message).toBe('Terjadi kesalahan pada sistem. Tim kami sudah dicatat kejadiannya.');
    }
  });

  it('passes an AppError through with its own code and Indonesian message', async () => {
    const action = safeAction(
      { name: 'test.missing', schema, loadContext: async () => ownerContext },
      async () => {
        throw new NotFoundError('no row for id 42');
      },
    );

    const result = await action({ name: 'Budi' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(result.error.message).toBe('Data yang Anda cari tidak ditemukan.');
    }
  });

  it('reports a Postgres RLS refusal as a permission problem, not a system failure', async () => {
    // SQLSTATE 42501. Telling the user "the system is broken" when the truth is
    // "you are not allowed" sends them to the wrong person for help.
    const action = safeAction(
      { name: 'test.rls', schema, loadContext: async () => ownerContext },
      async () => {
        throw Object.assign(new Error('new row violates row-level security policy'), { code: '42501' });
      },
    );

    const result = await action({ name: 'Budi' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ERROR_CODES.PERMISSION_DENIED);
  });

  it('never throws, whatever the handler does', async () => {
    const action = safeAction(
      { name: 'test.throwsString', schema, loadContext: async () => ownerContext },
      async () => {
        throw 'not even an Error object';
      },
    );

    await expect(action({ name: 'Budi' })).resolves.toMatchObject({ ok: false });
  });
});
