import { describe, expect, it } from 'vitest';
import { transition } from './service-ticket-transition';

describe('transition -- the service ticket state machine (ADR 0019 SS6)', () => {
  it('allows open -> in_progress', () => {
    const result = transition('open', 'in_progress');
    expect(result).toEqual({ ok: true, value: 'in_progress' });
  });

  it('allows open -> cancelled', () => {
    const result = transition('open', 'cancelled');
    expect(result).toEqual({ ok: true, value: 'cancelled' });
  });

  it('allows in_progress -> resolved', () => {
    const result = transition('in_progress', 'resolved');
    expect(result).toEqual({ ok: true, value: 'resolved' });
  });

  it('allows in_progress -> cancelled', () => {
    const result = transition('in_progress', 'cancelled');
    expect(result).toEqual({ ok: true, value: 'cancelled' });
  });

  it('refuses open -> resolved, skipping in_progress', () => {
    const result = transition('open', 'resolved');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toMatch(/tidak diperbolehkan/);
  });

  it('refuses resolved -> anything -- a terminal state', () => {
    expect(transition('resolved', 'open').ok).toBe(false);
    expect(transition('resolved', 'in_progress').ok).toBe(false);
    expect(transition('resolved', 'cancelled').ok).toBe(false);
  });

  it('refuses cancelled -> anything -- also terminal', () => {
    expect(transition('cancelled', 'open').ok).toBe(false);
    expect(transition('cancelled', 'in_progress').ok).toBe(false);
    expect(transition('cancelled', 'resolved').ok).toBe(false);
  });

  it('refuses a no-op transition to the same status', () => {
    expect(transition('open', 'open').ok).toBe(false);
    expect(transition('in_progress', 'in_progress').ok).toBe(false);
  });
});
