/**
 * The error code catalogue (ARCHITECTURE.md 5.1, CLAUDE.md 5).
 *
 * Codes are stable identifiers. The UI maps them to Indonesian text and logs
 * aggregate on them, so renaming one is a breaking change in two places at
 * once. Adding an error means adding a code here -- never a free-form string
 * thrown at a call site, because a free-form string cannot be counted,
 * translated, or searched for.
 *
 * Domain codes arrive with their phases -- defining them earlier would be
 * building ahead of the build sequence (CLAUDE.md law 7). CASH_GATE_RED and
 * HOLD_POINT_PENDING are still pending their own phases; VARIATION_INVALID_
 * TRANSITION arrived with Fase 3 (ADR 0012).
 *
 * Keep this file in step with docs/error-codes.md, which is the version an
 * auditor reads.
 */
export const ERROR_CODES = {
  /** Input failed schema validation at a boundary. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  /** No signed-in user. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',

  /** Signed in, but the permission matrix says no. */
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  /**
   * Signed in, but the account has no usable organisation -- suspended,
   * soft-deleted, or a profile row that was never provisioned. Separate from
   * UNAUTHENTICATED because the remedy is different: this one needs an
   * administrator, not another sign-in attempt.
   */
  ORG_CONTEXT_MISSING: 'ORG_CONTEXT_MISSING',

  /** The row does not exist, or RLS makes it invisible -- indistinguishable on purpose. */
  NOT_FOUND: 'NOT_FOUND',

  /** The data changed underneath this request (optimistic locking). */
  CONFLICT: 'CONFLICT',

  /**
   * An override or approval was attempted without a reason. Its own code
   * because it is the one validation failure that is an audit finding rather
   * than a typo.
   */
  AUDIT_REASON_REQUIRED: 'AUDIT_REASON_REQUIRED',

  /**
   * A Variation (change order) transition was refused -- either the event
   * does not exist for the current status, or a guard failed (wrong actor
   * role for the event, or client_approve attempted before cost/schedule
   * impact were filled in). ADR 0012.
   */
  VARIATION_INVALID_TRANSITION: 'VARIATION_INVALID_TRANSITION',

  /**
   * A work package tried to attach to a change order that is not
   * `approved_funded` yet (ARCHITECTURE.md 4.3). Distinct from
   * VARIATION_INVALID_TRANSITION because the remedy is different: waiting
   * for funding confirmation, not retrying a different action.
   */
  VARIATION_NOT_FUNDED: 'VARIATION_NOT_FUNDED',

  /** Supabase, storage, or another dependency failed. Never shown verbatim to a client. */
  INFRA_UNAVAILABLE: 'INFRA_UNAVAILABLE',

  /** Too many magic link requests. */
  RATE_LIMITED: 'RATE_LIMITED',

  /** The catch-all. An unexpected code in the logs is a bug, not a category. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * What the user reads. Indonesian, per owner decision D10, and deliberately
 * free of infrastructure detail: ARCHITECTURE.md 5.1 rule 4 keeps the user
 * message and the log message separate so a client portal cannot leak a
 * Postgres error string.
 *
 * These are defaults. A call site with something more useful to say passes its
 * own message; this is what shows when it does not.
 */
export const ERROR_MESSAGES_ID: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Data yang dimasukkan belum benar. Periksa kembali isian Anda.',
  UNAUTHENTICATED: 'Sesi Anda sudah berakhir. Silakan masuk kembali.',
  PERMISSION_DENIED: 'Anda tidak memiliki akses untuk tindakan ini.',
  ORG_CONTEXT_MISSING: 'Akun Anda belum terhubung ke organisasi mana pun. Hubungi admin.',
  NOT_FOUND: 'Data yang Anda cari tidak ditemukan.',
  CONFLICT: 'Data ini baru saja diubah orang lain. Muat ulang halaman lalu coba lagi.',
  AUDIT_REASON_REQUIRED: 'Alasan wajib diisi untuk tindakan persetujuan atau override.',
  VARIATION_INVALID_TRANSITION: 'Perubahan status untuk variation ini tidak diperbolehkan saat ini.',
  VARIATION_NOT_FUNDED: 'Variation ini belum berstatus "dana masuk" -- pekerjaan belum bisa dibuka.',
  INFRA_UNAVAILABLE: 'Sistem sedang tidak dapat diakses. Coba beberapa saat lagi.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
  INTERNAL_ERROR: 'Terjadi kesalahan pada sistem. Tim kami sudah dicatat kejadiannya.',
};

/** HTTP status per code, for route handlers. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  PERMISSION_DENIED: 403,
  ORG_CONTEXT_MISSING: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AUDIT_REASON_REQUIRED: 422,
  VARIATION_INVALID_TRANSITION: 422,
  VARIATION_NOT_FUNDED: 422,
  INFRA_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};
