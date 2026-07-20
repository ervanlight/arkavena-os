/**
 * Result, the return type of every domain function that can refuse.
 *
 * ARCHITECTURE.md 5.1 rule 1: the domain layer does not throw for business
 * rules. A blocked Cash Gate, an illegal state transition, an unmet hold point
 * -- these are answers, not accidents, and an answer belongs in the return
 * type where the compiler makes the caller deal with it. `throw` is reserved
 * for genuinely exceptional things, which in practice means infrastructure.
 *
 * The practical difference: a caller that forgets to handle a thrown
 * DomainRuleError still compiles. A caller that forgets to check `ok` cannot
 * reach `.value` at all.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return !result.ok;
}

/**
 * Unwrap, throwing if the result is an error.
 *
 * For tests and for code that has already established the result is ok. Using
 * this to avoid handling a domain error defeats the purpose of the type -- if
 * you find yourself reaching for it in an action, handle the error instead.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Called unwrap on an error result: ${JSON.stringify(result.error)}`);
}

/** Map the success value, leaving an error untouched. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}
