# ADR 0002 — Money is `bigint` rupiah; ratios are integer basis points

**Status:** Accepted
**Date:** 2026-07-20
**Needs owner confirmation:** no (ratifies ARCHITECTURE.md §0.5 and owner decision D6)

## Context

JavaScript's `number` is an IEEE-754 double. It represents integers exactly only
up to 2^53 − 1, which is 9,007,199,254,740,991. In rupiah that is about 9.007
*quadrillion* — comfortably above any single contract, so the naive reading is
that `number` is safe.

That reading is wrong for two reasons.

First, the limit that bites is not the size of one contract but the size of an
intermediate result. Funding coverage is computed as a ratio; done naively that
means multiplying an amount by a scaling factor before dividing. A 50 billion
rupiah portfolio multiplied by 10,000 basis points is 5×10^14 — still under the
limit, but a second factor puts it over, and the failure is silent: no exception,
just a number that is quietly wrong in the last digits.

Second, and more common, is decimal fractions. `0.1 + 0.2 === 0.30000000000000004`
holds for money as much as anything else. A rounding rule applied twice in
different places produces two different totals for the same invoice, and the
discrepancy surfaces as a client dispute rather than a stack trace.

Neither failure announces itself. That is what makes this a structural decision
rather than a coding-style preference.

## Decision

All monetary amounts are `bigint`, in whole rupiah, with no decimal component.
Database columns are `BIGINT` and named `*_amount`.

`core/money/rupiah.ts` exports a branded type `Rupiah = bigint & { __brand }` and
the only arithmetic permitted on amounts: `addRp`, `subRp`, `mulRp`, `ratioBp`,
`formatRp`. The brand means a plain `bigint` cannot be passed where a `Rupiah` is
expected without going through `toRupiah`, so an unconverted value from an
external source cannot drift into a calculation unnoticed.

Ratios are integer **basis points**: `11000` means 1.1000. The Cash Gate
thresholds (`11000` green, `10000` yellow floor) are named constants in
`core/money`, mirrored as SQL constants in `fn_cash_gate_status()`.

Division is explicit and its rounding is stated at the call site. There is no
implicit rounding anywhere.

ESLint rejects `Number(<something>Amount)` and `Math.round/floor/ceil` outside
`core/money`.

## Consequences

Easy: exact arithmetic at any magnitude. The unit test in
`src/core/money/rupiah.test.ts` computes above 2^53 and shows the float
equivalent losing precision on the same input — so the reason for this rule is
demonstrated in the test suite, not just asserted in a document.

Hard: `bigint` does not serialise to JSON. Every boundary that crosses the wire —
server action results, API payloads — must convert explicitly, and the receiving
side must convert back. This is friction on purpose: each conversion is a place
someone had to think about precision.

Also hard: `bigint` and `number` cannot be mixed in one expression without a
TypeError. This is a feature. The error fires at the moment of the mistake rather
than in a total three screens later.

Reversal cost: very high, and it would be a data migration, not a refactor.

## Alternatives considered

**`number` with a "just don't use decimals" convention.** Rejected: conventions
that depend on everyone remembering are not enforcement, and the failure is
silent.

**Storing rupiah as strings.** Exact, but every operation needs parsing, and the
type system stops helping — `"1000" + "2000"` is `"10002000"` and compiles fine.

**A decimal library (decimal.js, dinero.js).** Correct, and a reasonable choice
for multi-currency systems with sub-unit precision. Rejected here because rupiah
has no sub-unit in practice, so `bigint` gives exactness with no dependency, no
bundle cost, and native operators.
