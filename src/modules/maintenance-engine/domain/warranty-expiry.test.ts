import { describe, expect, it } from 'vitest';
import { warrantyExpiryTier } from './warranty-expiry';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const endsAt = 1767225600000; // 2026-01-01T00:00:00.000Z, as epoch ms
const at = (days: number): number => endsAt + days * MS_PER_DAY;

describe('warrantyExpiryTier', () => {
  it('is active well before the expiry window opens', () => {
    expect(warrantyExpiryTier(endsAt, at(-60))).toBe('active');
  });

  it('becomes expiring_soon at exactly 30 days before expiry (the boundary)', () => {
    expect(warrantyExpiryTier(endsAt, at(-30))).toBe('expiring_soon');
  });

  it('is expiring_soon at 1 day before expiry', () => {
    expect(warrantyExpiryTier(endsAt, at(-1))).toBe('expiring_soon');
  });

  it('is expiring_soon on the expiry date itself', () => {
    expect(warrantyExpiryTier(endsAt, at(0))).toBe('expiring_soon');
  });

  it('becomes expired the day after the expiry date', () => {
    expect(warrantyExpiryTier(endsAt, at(1))).toBe('expired');
  });

  it('stays expired arbitrarily far past the boundary', () => {
    expect(warrantyExpiryTier(endsAt, at(400))).toBe('expired');
  });
});
