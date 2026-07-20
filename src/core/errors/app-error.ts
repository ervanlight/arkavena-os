import { ERROR_CODES, ERROR_HTTP_STATUS, ERROR_MESSAGES_ID, type ErrorCode } from './codes';

/**
 * The error hierarchy (ARCHITECTURE.md 5.1).
 *
 * Two audiences, kept apart on purpose:
 *
 *   userMessage -- Indonesian, safe to show anyone, including a client in the
 *                  portal. Never contains a table name, a query, or a stack.
 *   meta        -- technical context for the log: org, project, request id.
 *                  Never rendered.
 *
 * Mixing them is how a Postgres error string ends up on a client's screen. So
 * `message` (the Error field, which goes to logs) and `userMessage` (which goes
 * to the UI) are separate fields, and the conversion in handle.ts only ever
 * reads the latter.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;

  /** Indonesian, safe for any audience. */
  readonly userMessage: string;

  /** Technical context for structured logs. Never shown to a user. */
  readonly meta: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { userMessage?: string; meta?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    // Subclasses set `code` as a class field, which initialises after this
    // constructor body. So the default user message is resolved lazily in the
    // getter path rather than read from this.code here.
    this.userMessage = options?.userMessage ?? '';
    this.meta = Object.freeze({ ...options?.meta });
  }

  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }

  /** The user-facing text, falling back to the catalogue default for the code. */
  get displayMessage(): string {
    return this.userMessage !== '' ? this.userMessage : ERROR_MESSAGES_ID[this.code];
  }
}

/** Input failed validation at a boundary. `field` drives inline form errors. */
export class ValidationError extends AppError {
  readonly code = ERROR_CODES.VALIDATION_FAILED;
  readonly field: string | undefined;

  constructor(
    message: string,
    options?: { field?: string; userMessage?: string; meta?: Record<string, unknown> },
  ) {
    super(message, options);
    this.field = options?.field;
  }
}

/** No signed-in user. */
export class UnauthenticatedError extends AppError {
  readonly code = ERROR_CODES.UNAUTHENTICATED;
}

/** Signed in, but not allowed. Raised by requirePermission and by RLS refusals. */
export class PermissionError extends AppError {
  readonly code = ERROR_CODES.PERMISSION_DENIED;
}

/** Signed in, but the account resolves to no usable organisation. */
export class OrgContextError extends AppError {
  readonly code = ERROR_CODES.ORG_CONTEXT_MISSING;
}

export class NotFoundError extends AppError {
  readonly code = ERROR_CODES.NOT_FOUND;
}

/** The row changed under this request. */
export class ConflictError extends AppError {
  readonly code = ERROR_CODES.CONFLICT;
}

/** An override or approval reached the audit layer without a reason. */
export class AuditReasonRequiredError extends AppError {
  readonly code = ERROR_CODES.AUDIT_REASON_REQUIRED;
}

/**
 * Infrastructure failed: Supabase, storage, the network.
 *
 * This is the one class where the distinction between `message` and
 * `userMessage` earns its keep. The cause is kept for the log; the user sees
 * only the generic catalogue text.
 */
export class InfraError extends AppError {
  readonly code = ERROR_CODES.INFRA_UNAVAILABLE;
}

export class RateLimitError extends AppError {
  readonly code = ERROR_CODES.RATE_LIMITED;
}

/**
 * A bug. Something threw that we had no category for.
 *
 * Kept separate from InfraError because the two tell the user to do different
 * things. "The system is temporarily unavailable" invites a retry; if the cause
 * was a TypeError in our own code, that retry will fail exactly the same way
 * forever. This one says the failure has been recorded instead.
 */
export class InternalError extends AppError {
  readonly code = ERROR_CODES.INTERNAL_ERROR;
}

/**
 * A business rule said no.
 *
 * Domain layers return this inside a Result rather than throwing it
 * (ARCHITECTURE.md 5.1 rule 1). It carries its own code because "which rule
 * refused" is the whole content of the error -- CASH_GATE_RED and
 * HOLD_POINT_PENDING mean entirely different things to the person reading it.
 *
 * `blockedReasons` exists because ARCHITECTURE.md 4.4 requires a blocked
 * quality gate to report every reason, not the first one found. A user told to
 * fix one thing, who then discovers a second, has been failed twice.
 */
export class DomainRuleError extends AppError {
  readonly code: ErrorCode;
  readonly blockedReasons: readonly string[];

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      userMessage?: string;
      blockedReasons?: readonly string[];
      meta?: Record<string, unknown>;
    },
  ) {
    super(message, options);
    this.code = code;
    this.blockedReasons = Object.freeze([...(options?.blockedReasons ?? [])]);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
