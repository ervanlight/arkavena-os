import { describe, expect, it } from 'vitest';
import {
  isStorageUsageCritical,
  STORAGE_ALERT_THRESHOLD_BYTES,
  STORAGE_LIMIT_BYTES,
  storageUsageRatio,
} from './usage';

describe('storage usage thresholds (owner decision D2: alert at 70%)', () => {
  it('the limit matches Supabase Free tier: 1GB', () => {
    expect(STORAGE_LIMIT_BYTES).toBe(1024 * 1024 * 1024);
  });

  it('the alert threshold is exactly 70% of the limit', () => {
    expect(STORAGE_ALERT_THRESHOLD_BYTES).toBe(Math.floor(STORAGE_LIMIT_BYTES * 0.7));
  });

  it('is not critical just below the threshold', () => {
    expect(isStorageUsageCritical(STORAGE_ALERT_THRESHOLD_BYTES - 1)).toBe(false);
  });

  it('is critical exactly at the threshold', () => {
    expect(isStorageUsageCritical(STORAGE_ALERT_THRESHOLD_BYTES)).toBe(true);
  });

  it('is critical above the threshold, including over the limit itself', () => {
    expect(isStorageUsageCritical(STORAGE_LIMIT_BYTES)).toBe(true);
    expect(isStorageUsageCritical(STORAGE_LIMIT_BYTES * 2)).toBe(true);
  });

  it('computes a plain 0-1 ratio for display', () => {
    expect(storageUsageRatio(0)).toBe(0);
    expect(storageUsageRatio(STORAGE_LIMIT_BYTES)).toBe(1);
    expect(storageUsageRatio(STORAGE_LIMIT_BYTES / 2)).toBeCloseTo(0.5);
  });
});
