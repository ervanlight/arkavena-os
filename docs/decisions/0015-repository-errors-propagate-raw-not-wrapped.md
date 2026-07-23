# ADR 0015 — Repositories re-throw the raw Postgrest error instead of wrapping it in InfraError

**Status:** Accepted
**Date:** 2026-07-22
**Needs owner confirmation:** yes — confirmed 2026-07-22 (owner chose option (a) over (b))

## Context

Every `data/` repository (93 call sites across cash-gate, scope-variation,
field-reporting, quality-gate, projects, crm) follows the same pattern:

```ts
const { data, error } = await supabase.from('...').select(...);
if (error !== null) {
  throw new InfraError(`Failed to load X for project ${projectId}: ${error.message}`);
}
```

`core/errors/handle.ts`'s `asAppError()` is the single place (CLAUDE.md 5,
ARCHITECTURE.md 5.1) that is supposed to classify an unknown thrown value into
the right `AppError` subclass — in particular, to recognise a Postgrest error
whose `code` is `23514`/`P0001` **and** which carries a `hint` as a
deliberately-authored, user-facing business-rule message from one of this
codebase's own triggers (`fn_work_packages_guard_hold_point`,
`fn_work_packages_guard_cash_gate`, the `change_orders` transition guards),
and to surface it verbatim rather than as a generic infra failure.

That classification logic in `asAppError` is correct and unit-tested
(`handle.test.ts`) in isolation, but it never runs in production. `asAppError`
starts with:

```ts
if (isAppError(error)) return error;
```

By the time any thrown value reaches `safeAction`'s catch block, the
repository has already wrapped it in `InfraError` — which is itself an
`AppError` — so `isAppError(error)` is true and `asAppError` returns it
unchanged before the Postgrest-classification branch ever executes. The
original `code`/`hint`/`message` on the Postgrest error object are still
intact at that point; they are simply never looked at again, because the
value in hand is no longer that object.

Confirmed via `e2e/quality-gate.spec.ts` with a strict assertion on the
alert's text: starting a work package blocked by a failed hold point shows
only `InfraError`'s generic "Sistem sedang tidak dapat diakses. Coba beberapa
saat lagi." instead of "Hold point belum lulus: ...". The same shape of bug
almost certainly affects Cash Gate's and Change Orders' equivalent refusal
messages — their e2e specs (`cash-gate.spec.ts`, `variation.spec.ts`) never
caught it because they only assert `getByRole('alert')` is visible, not its
text.

This has been true since Fase 2, the first phase with a repository. It is not
new breakage from recent work; it is a latent bug in a pattern that every
subsequent phase copied.

## Decision

Repositories stop classifying errors. A repository's job is data access, not
error taxonomy — classification already has exactly one designated place
(`asAppError`), and CLAUDE.md 4's `safeAction` pattern already treats
"map anything thrown onto `ActionResult`" as a single centralized step, not
a per-call-site one.

Concretely, every one of the 93 call sites changes from:

```ts
if (error !== null) {
  throw new InfraError(`Failed to <verb> <noun> ...: ${error.message}`);
}
```

to:

```ts
if (error !== null) throw error;
```

(`error` here is whatever the destructured Postgrest result error is named at
that call site — sometimes `error`, sometimes `clearedResult.error` etc. in
`gate-state-repository.ts`'s `Promise.all` case — the `!== null` check and
control flow are unchanged, only what gets thrown.)

`@supabase/postgrest-js`'s `PostgrestError` already extends `Error` and
already carries `code`, `message`, `hint`, and `details` as real fields
(confirmed in `handle.test.ts`'s own `postgrestError()` helper, which
constructs one the same way). Throwing it unchanged means `asAppError`'s
existing `isPostgrestLike(error) && typeof error.code === 'string'` branch —
already written, already tested — runs exactly as designed, for every call
site, with no further change needed to `handle.ts`, `app-error.ts`, or their
tests.

`InfraError` itself is untouched. It remains what `asAppError` constructs
when it classifies an un-hinted, un-mapped, or network-layer failure — the
class's job stays "this is what the user sees for a real infra failure,"
not "this is what every repository throws by default."

## Consequences

**What this makes easy:** a business-rule message written once in a trigger's
`hint` now reaches the user everywhere that trigger fires, with zero
per-call-site awareness required. Any *new* repository method written after
this change gets correct classification for free just by propagating the
error, which is less code than the old pattern, not more — there is nothing
left to remember to add.

**What this makes harder / what we accept as a cost:** the contextual prefix
each site used to add (`Failed to load cleared funds for project ${projectId}`)
is gone from the thrown error's `message`. That prefix only ever reached the
structured log (`safeAction`'s `logger.error('action.failed', ...)`), never
the user — and even there it was inconsistently present, since `asAppError`'s
own generic fallback path (network failures, unmapped Postgres codes) already
constructed `InfraError` from the bare `error.message` with no such prefix.
`logger.error` already logs `action` (the server action's name, e.g.
`cashGate.recordFundingReceipt`) and `meta`, which is enough to identify which
operation failed without the per-repository-method prose. No log field is
being removed, only a piece of hand-written redundant text.

**Reversal cost:** low. This is a mechanical, uniform substitution (verified:
every one of the 93 sites is `if (X.error !== null) { throw new InfraError(...); }`
with nothing else in the block — no additional logging, no side effects) and
the reverse substitution is equally mechanical if this decision needs undoing.

**Verification:** re-ran `e2e/quality-gate.spec.ts` and `cash-gate.spec.ts`
with a stricter assertion on the actual alert text (not just visibility).
Both now pass against the real trigger message. Two secondary problems
surfaced only by running the real browser, not the isolated unit tests:

1. `asAppError`'s own message extraction (`error instanceof Error ? error.message
   : String(error)`) turned out to be wrong for the real shape it classifies
   most often: `@supabase/supabase-js`'s default, non-`.throwOnError()` query
   path returns `error` as a plain `JSON.parse`'d object, not a `PostgrestError`
   instance (postgrest-js's `PostgrestBuilder._parseResponse` only constructs
   that class on the opt-in throwing path this codebase never uses — read
   directly from its source to confirm). `handle.test.ts`'s original fixture
   built an `Error` instance instead, which passed the unit test while masking
   this exact bug — every real classified error rendered its user-facing
   message as literally `"[object Object]"` until this call was widened to
   also read `.message` off a plain postgrest-shaped object. Fixed in
   `handle.ts` and the test fixture corrected to match the real shape.
2. `getByRole('alert')` matched two elements in the real DOM — the form's own
   `<span role="alert">` and Next.js's route announcer
   (`#__next-route-announcer__`, also `role="alert"`) — a strict-mode
   violation Playwright only reports on assertions that read content
   (`toHaveText`), not on `toBeVisible()`, which is why the original
   visibility-only assertions never caught it. Both specs now scope to
   `span[role="alert"]`.

Neither of these two problems is specific to this ADR's decision — both were
latent defects `asAppError`'s pre-existing unit tests happened not to exercise
— but both were invisible until this ADR's fix let a real classified error
reach the browser for the first time.

## Alternatives considered

**(b) Give `InfraError` (or a new wrapper) a way to carry the original
`code`/`hint`/`message` forward, and teach a later stage to re-classify it.**
Rejected: this does not reduce the scope of the mechanical change — all 93
call sites would still need editing, to pass `error.code`/`error.hint` into
the wrapper's constructor instead of just a string. It adds new state to
`InfraError` (or a new class) that has to stay in sync with whatever
`asAppError` expects, and it requires `asAppError`'s `isAppError(error) return
error` early-return to grow a second branch that inspects an already-`AppError`
value for latent postgrest fields — duplicating the classification logic that
already exists for the raw case. It also muddies what `InfraError` means: an
`InfraError` that secretly carries a hint which can later promote it to a
`ValidationError` is a class whose name no longer describes its contract.
Option (a) reuses the classification logic that already exists and is already
tested, touches every call site exactly once, and leaves `InfraError`'s
meaning unchanged.

**Leave the repositories alone and duplicate the hint-check logic at each call
site instead of centralizing it.** Rejected outright: this is exactly the
"ad-hoc try/catch per feature" CLAUDE.md 4 and ARCHITECTURE.md 5.1 rule 2 name
as the failure mode `safeAction` exists to prevent — 93 places to keep in sync
with any future change to how a hint is recognised, instead of one.
