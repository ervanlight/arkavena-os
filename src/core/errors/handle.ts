import {
  ConflictError,
  InfraError,
  InternalError,
  NotFoundError,
  PermissionError,
  ValidationError,
  isAppError,
} from './app-error';
import type { AppError } from './app-error';
import { ERROR_CODES, ERROR_MESSAGES_ID, type ErrorCode } from './codes';

/**
 * The single shape every server action returns (ARCHITECTURE.md 3.4).
 *
 * One shape means the UI has one handler for failure rather than a bespoke
 * try/catch per feature, and it means an action physically cannot return a
 * half-success.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; field?: string; blockedReasons?: readonly string[] } };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  code: ErrorCode,
  message: string,
  extra?: { field?: string; blockedReasons?: readonly string[] },
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(extra?.field !== undefined ? { field: extra.field } : {}),
      ...(extra?.blockedReasons !== undefined ? { blockedReasons: extra.blockedReasons } : {}),
    },
  };
}

/** Postgres SQLSTATEs we can translate into something a user can act on. */
const PG_ERROR_MAP: Record<string, ErrorCode> = {
  '23505': ERROR_CODES.CONFLICT, // unique_violation
  '23503': ERROR_CODES.CONFLICT, // foreign_key_violation
  '23514': ERROR_CODES.VALIDATION_FAILED, // check_violation
  '42501': ERROR_CODES.PERMISSION_DENIED, // insufficient_privilege -- an RLS refusal
  P0001: ERROR_CODES.VALIDATION_FAILED, // raise_exception from one of our triggers
};

function isPostgrestLike(value: unknown): value is { code?: string; message?: string; hint?: string | null } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

/**
 * Who is reading the error message. 'staff' (default) sees the specific
 * message an error carries -- trigger hints, domain rule wording, blocked
 * reasons -- all written in staff vocabulary ("hold point", "Cash Gate",
 * "termin", ADR references). 'external' is a client-portal or partner-desk
 * caller: every message except our own field-level input validation collapses
 * to the catalogue's generic Indonesian text (ADR 0015 follow-up,
 * PRE-LAUNCH-CHECKLIST item 1). The code stays intact either way, so the UI
 * can still branch and support can still correlate.
 */
export type ErrorAudience = 'staff' | 'external';

/**
 * Turn anything thrown into an ActionResult.
 *
 * Two rules govern this function.
 *
 * First, an unknown error never reaches the user verbatim. Supabase errors carry
 * table names, column names, and sometimes row contents; a client portal user
 * seeing that is an information leak, so unrecognised errors collapse to
 * INTERNAL_ERROR with the catalogue's generic Indonesian text, and the detail
 * goes to the log instead.
 *
 * Second, an RLS refusal is reported as PERMISSION_DENIED rather than as a
 * database failure, because that is what it means.
 *
 * Third (external audience only): even a *recognised* error's specific message
 * is staff-facing text -- trigger messages and domain rule wording assume the
 * reader knows internal process names. For an external caller the message
 * falls back to the catalogue entry for its code, except field-level
 * validation, whose text comes from our own Zod schemas and is written for
 * the person filling the form.
 */
export function toActionResult(error: unknown, opts?: { audience?: ErrorAudience }): ActionResult<never> {
  const audience = opts?.audience ?? 'staff';

  if (isAppError(error)) {
    const field = error instanceof Object && 'field' in error ? (error.field as string | undefined) : undefined;
    const blockedReasons =
      'blockedReasons' in error ? (error.blockedReasons as readonly string[] | undefined) : undefined;

    if (audience === 'external' && field === undefined) {
      // No blockedReasons either: those strings are staff wording too.
      return actionFail(error.code, ERROR_MESSAGES_ID[error.code]);
    }

    return actionFail(error.code, error.displayMessage, {
      ...(field !== undefined ? { field } : {}),
      ...(audience === 'staff' && blockedReasons !== undefined && blockedReasons.length > 0
        ? { blockedReasons }
        : {}),
    });
  }

  if (isPostgrestLike(error) && typeof error.code === 'string') {
    const mapped = PG_ERROR_MAP[error.code];
    if (mapped !== undefined) {
      return actionFail(mapped, ERROR_MESSAGES_ID[mapped]);
    }
  }

  return actionFail(ERROR_CODES.INTERNAL_ERROR, ERROR_MESSAGES_ID[ERROR_CODES.INTERNAL_ERROR]);
}

/**
 * Wrap an unknown thrown value as an AppError so it can be logged with context.
 * Used by safeAction; the returned error is logged, never rendered.
 */
export function asAppError(error: unknown, meta?: Record<string, unknown>): AppError {
  if (isAppError(error)) return error;

  // supabase-js's default (non-`.throwOnError()`) query result carries `error`
  // as a plain `JSON.parse`'d object -- postgrest-js only wraps it in the
  // `PostgrestError` class (an actual `Error` subclass) on the opt-in
  // throwing path this codebase does not use. So `error instanceof Error`
  // is false for the real shape this function classifies most often, and
  // reading `.message` only in that branch silently fell through to
  // `String(error)` ("[object Object]") for every real Postgres/PostgREST
  // failure -- masked in this file's own tests by a fixture that happened to
  // extend `Error`.
  const message =
    error instanceof Error
      ? error.message
      : isPostgrestLike(error) && typeof error.message === 'string'
        ? error.message
        : String(error);
  const options = { meta: meta ?? {}, cause: error };

  if (isPostgrestLike(error) && typeof error.code === 'string') {
    switch (PG_ERROR_MAP[error.code]) {
      case ERROR_CODES.PERMISSION_DENIED:
        return new PermissionError(message, options);
      case ERROR_CODES.CONFLICT:
        return new ConflictError(message, options);
      case ERROR_CODES.NOT_FOUND:
        return new NotFoundError(message, options);
      case ERROR_CODES.VALIDATION_FAILED: {
        // Every `raise exception ... using errcode = 'check_violation'` this
        // codebase's own migrations write also sets a `hint` pointing at the
        // architecture doc/ADR it enforces -- deliberately, since the message
        // itself is already user-safe Indonesian text (CLAUDE.md 5). A real
        // Postgres-generated CHECK constraint violation never has a hint, and
        // its message/details name real tables, columns and row contents
        // (confirmed by hand: inserting a blank-name row surfaces "Failing
        // row contains (...)" in `details`) that must never reach a user --
        // so only the hinted case is safe to show verbatim.
        if (typeof error.hint === 'string' && error.hint !== '') {
          return new ValidationError(message, { meta: options.meta, userMessage: message });
        }
        return new InfraError(message, options);
      }
      default:
        // A Postgres error we have no mapping for is still a database failure.
        return new InfraError(message, options);
    }
  }

  // A network-layer failure is genuinely worth retrying; an arbitrary throw is
  // a bug in our code, and telling the user to try again would send them into a
  // loop that cannot succeed.
  if (isNetworkFailure(error)) {
    return new InfraError(message, options);
  }

  return new InternalError(message, options);
}

/** Fetch and undici surface connection problems as a TypeError with a cause. */
function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return error instanceof TypeError && /fetch failed|network|ECONN|ENOTFOUND|socket/i.test(error.message);
}
