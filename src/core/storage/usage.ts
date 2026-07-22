/**
 * Storage usage thresholds (owner decision D2/D9): Supabase Free gives 1GB
 * total. At the 200-400KB-per-photo compression target plus a thumbnail,
 * the practical ceiling is roughly 3,000 photos -- D2's own words, "ini
 * metric yang diawasi, bukan set-and-forget".
 *
 * Pure constants and a pure check, no database access -- the actual byte
 * count comes from modules/field-reporting (it owns the `photos` table
 * that answer requires; core may not query another module's table
 * directly, CLAUDE.md law 2).
 */

export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // Supabase Free tier, 1GB (ADR D9)
export const STORAGE_ALERT_THRESHOLD_RATIO = 0.7; // D2: "alert saat menembus 70%"
export const STORAGE_ALERT_THRESHOLD_BYTES = Math.floor(STORAGE_LIMIT_BYTES * STORAGE_ALERT_THRESHOLD_RATIO);

export function isStorageUsageCritical(totalBytesUsed: number): boolean {
  return totalBytesUsed >= STORAGE_ALERT_THRESHOLD_BYTES;
}

export function storageUsageRatio(totalBytesUsed: number): number {
  return totalBytesUsed / STORAGE_LIMIT_BYTES;
}
