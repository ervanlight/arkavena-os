import { describe, expect, it } from 'vitest';
import {
  createDailyLogSchema,
  createIssueSchema,
  createMaterialRequestSchema,
  createPhotoSchema,
  createProgressEntrySchema,
} from './schemas';

// Zod v4's .uuid() checks the RFC 4122 version/variant nibbles, not just the
// shape -- a same-digit-repeated string like '1111...1111' fails validation,
// so every fixture id needs a real version (4) and variant (8) nibble.
const id = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const dailyLogId = '33333333-3333-4333-8333-333333333333';
const workPackageId = '44444444-4444-4444-8444-444444444444';
const zoneId = '55555555-5555-4555-8555-555555555555';

describe('createDailyLogSchema', () => {
  it('accepts manpowerCount of exactly zero', () => {
    const result = createDailyLogSchema.safeParse({ id, projectId, logDate: '2026-07-22', manpowerCount: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects a negative manpowerCount', () => {
    const result = createDailyLogSchema.safeParse({ id, projectId, logDate: '2026-07-22', manpowerCount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer manpowerCount', () => {
    const result = createDailyLogSchema.safeParse({ id, projectId, logDate: '2026-07-22', manpowerCount: 5.5 });
    expect(result.success).toBe(false);
  });

  it('requires a caller-supplied id -- offline replay idempotency depends on it', () => {
    const result = createDailyLogSchema.safeParse({ projectId, logDate: '2026-07-22' });
    expect(result.success).toBe(false);
  });
});

describe('createProgressEntrySchema -- progress_percent boundaries (ck_progress_entries_percent_range)', () => {
  it.each([0, 50, 100])('accepts %i as a valid boundary or midpoint value', (progressPercent) => {
    const result = createProgressEntrySchema.safeParse({
      id,
      projectId,
      dailyLogId,
      workPackageId,
      progressPercent,
    });
    expect(result.success).toBe(true);
  });

  it.each([-1, 101])('rejects %i, one past each end of the valid range', (progressPercent) => {
    const result = createProgressEntrySchema.safeParse({
      id,
      projectId,
      dailyLogId,
      workPackageId,
      progressPercent,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer progressPercent', () => {
    const result = createProgressEntrySchema.safeParse({
      id,
      projectId,
      dailyLogId,
      workPackageId,
      progressPercent: 42.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('createPhotoSchema -- fileSizeBytes (ck_photos_file_size_positive)', () => {
  it('rejects zero', () => {
    const result = createPhotoSchema.safeParse({
      id,
      projectId,
      zoneId,
      storagePath: 'a/b/c.jpg',
      thumbnailPath: 'a/b/c-thumb.jpg',
      fileSizeBytes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts the smallest positive integer', () => {
    const result = createPhotoSchema.safeParse({
      id,
      projectId,
      zoneId,
      storagePath: 'a/b/c.jpg',
      thumbnailPath: 'a/b/c-thumb.jpg',
      fileSizeBytes: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe('createMaterialRequestSchema -- quantity (ck_material_requests_quantity_positive)', () => {
  it.each([0, -1])('rejects %i', (quantity) => {
    const result = createMaterialRequestSchema.safeParse({
      id,
      projectId,
      itemDescription: 'Semen 50kg',
      quantity,
      unit: 'sak',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a fractional positive quantity (e.g. 2.5 kubik)', () => {
    const result = createMaterialRequestSchema.safeParse({
      id,
      projectId,
      itemDescription: 'Pasir',
      quantity: 2.5,
      unit: 'kubik',
    });
    expect(result.success).toBe(true);
  });
});

describe('createIssueSchema -- severity defaults', () => {
  it('lets severity be omitted -- the repository defaults it to medium, matching the column default', () => {
    const result = createIssueSchema.safeParse({ id, projectId, title: 'Retak dinding' });
    expect(result.success).toBe(true);
  });

  it('rejects a title-less issue', () => {
    const result = createIssueSchema.safeParse({ id, projectId, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognised severity value', () => {
    const result = createIssueSchema.safeParse({ id, projectId, title: 'Retak dinding', severity: 'critical' });
    expect(result.success).toBe(false);
  });
});
