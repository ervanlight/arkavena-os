import { ConflictError, InfraError, NotFoundError, PermissionError, isAppError } from './app-error';
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

function isPostgrestLike(value: unknown): value is { code?: string; message?: string } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

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
 */
export function toActionResult(error: unknown): ActionResult<never> {
  if (isAppError(error)) {
    const field = error instanceof Object && 'field' in error ? (error.field as string | undefined) : undefined;
    const blockedReasons =
      'blockedReasons' in error ? (error.blockedReasons as readonly string[] | undefined) : undefined;

    return actionFail(error.code, error.displayMessage, {
      ...(field !== undefined ? { field } : {}),
      ...(blockedReasons !== undefined && blockedReasons.length > 0 ? { blockedReasons } : {}),
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

  const message = error instanceof Error ? error.message : String(error);
  const options = { meta: meta ?? {}, cause: error };

  if (isPostgrestLike(error) && typeof error.code === 'string') {
    switch (PG_ERROR_MAP[error.code]) {
      case ERROR_CODES.PERMISSION_DENIED:
        return new PermissionError(message, options);
      case ERROR_CODES.CONFLICT:
        return new ConflictError(message, options);
      case ERROR_CODES.NOT_FOUND:
        return new NotFoundError(message, options);
      default:
        break;
    }
  }

  return new InfraError(message, options);
}
