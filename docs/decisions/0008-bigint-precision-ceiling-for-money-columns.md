# ADR 0008 — A safe-integer ceiling on every money column, enforced by CHECK constraint

**Status:** Accepted — owner approved on 2026-07-21
**Date:** 2026-07-21
**Needs owner confirmation:** no (this ADR records the owner's own decision)

## Context

CLAUDE.md law 1 and `core/money/rupiah.ts` both warn that a rupiah amount above
`Number.MAX_SAFE_INTEGER` (2^53) silently loses precision the moment it
becomes a JS `number` -- no error, no exception, just a wrong value that looks
plausible. Building `modules/projects`' contract and milestone actions
(`contracts.contract_amount`, `milestones.amount`, both `bigint`) surfaced that
this is not a theoretical risk confined to application arithmetic. It happens
one layer lower, and the application never gets a chance to guard against it.

Verified directly against the real database: inserting `9007199254740993`
(2^53 + 1) into `contract_amount` through the raw `pg` driver round-trips
exactly (`pg` parses Postgres `int8` as a JS string, precisely to avoid this).
Reading the same row back through `@supabase/supabase-js` -- the path every
repository in this codebase actually uses -- returned `9007199254740992`.
Off by one, silently, with no error anywhere in the chain. PostgREST's JSON
serialisation of `bigint`/`numeric` emits a bare JSON number, and the number
is already wrong by the time it reaches `JSON.parse` inside supabase-js --
before any of our own code, including `toRupiah()`, ever sees the value.
`toRupiah()` cannot catch this after the fact: `9007199254740992` is a
perfectly valid safe integer on its own terms. The corruption is invisible
downstream of where it happens.

Real Rupiah contract values do not approach this range. Indonesia's largest
infrastructure megaprojects run in the tens of trillions of rupiah (~10^13);
2^53 is approximately 9.007 * 10^15 -- roughly three orders of magnitude
higher. But "the values we expect never get that large" is exactly the kind
of assumption ARCHITECTURE.md 0.2 says must not be trusted alone for anything
touching money: the rule is enforced in two layers, application and database,
specifically so a bug in one does not silently become a wrong number in
production.

## Decision

Every money column gets an explicit `CHECK` constraint capping it at
`999_999_999_999_999` (999.999 trillion rupiah) -- comfortably above any
plausible single contract or milestone, comfortably below 2^53
(`9_007_199_254_740_992`), with headroom to spare. `20260721000500` adds this
to `contracts.contract_amount` and `milestones.amount` via `ALTER TABLE ...
ADD CONSTRAINT` (both tables were already applied when this was found, so
this is a new migration, not an edit to an applied one).

This does not replace the application-level discipline `core/money`
already provides -- `toRupiah()` at every boundary, the branded `Rupiah`
type, the ESLint rule blocking `Number(xxxAmount)` -- it closes the one gap
none of that reaches: a value large enough to corrupt during
deserialisation, before the application ever runs.

Future migrations introducing a money column (`invoices.amount`,
`payments.amount`, `funding_receipts.amount`, and the rest arriving in later
phases) must include the same constraint from their first migration, not add
it later. `docs/rls-matrix.md`-style enforcement (a lint or CI check that
every `bigint` column has a matching ceiling) is worth doing once there are
enough money columns that eyeballing each new migration stops being reliable
-- not yet, with two.

## Consequences

**A contract or milestone above ~999 trillion rupiah is rejected outright,**
not silently truncated. Given the realistic scale of the projects this
system manages, this is not expected to bind in practice; if it ever does,
that is a signal worth a human looking at directly rather than the ceiling
being quietly raised.

**This does not protect an aggregate that sums many rows into a JS number
without going through `core/money`.** The ceiling bounds any single stored
value; it does nothing for a query that does `sum(amount)` and returns the
result as a plain number without ever calling `toRupiah()`. That discipline
-- every money value entering application code passes through `core/money`
before any arithmetic -- remains the thing that actually has to hold, in both
directions.

**Reversal cost: low.** Raising or removing the ceiling is a single
`ALTER TABLE ... DROP CONSTRAINT` / `ADD CONSTRAINT` migration, not a
schema rework.

## Alternatives considered

**Cast money columns to `text` in a view, and read through the view instead
of the table.** Would solve the serialisation problem completely (a quoted
JSON string never loses precision), at the cost of every repository query
needing to go through a differently-shaped read path than every other
column, and an extra parse step (`toRupiah(row.contract_amount)`)
distinguishing money reads from every other field. Rejected for now as more
structural change than the actual risk (see Context) justifies; worth
revisiting if a money value ever needs to legitimately approach the ceiling
this ADR sets.

**Do nothing, and trust that real contract values never reach 2^53.**
Rejected: this is precisely the reasoning ARCHITECTURE.md 0.2 exists to
override for anything touching money. An assumption that happens to be true
today is not database-level enforcement, and the whole point of the two-layer
rule is that the second layer does not get to depend on the first one being
right forever.
