# Error codes

The catalogue of stable error codes (ARCHITECTURE.md §5.1, CLAUDE.md §5). The
executable version is `src/core/errors/codes.ts`; this is the version to read.

Codes are stable identifiers. Logs aggregate on them and the UI maps them to
Indonesian text, so renaming one breaks two things at once. Adding an error
means adding a code — never a free-form string thrown at a call site, because a
free-form string cannot be counted, searched, or translated.

## Kernel codes

| Code | HTTP | Indonesian message shown to the user | When |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | 422 | Data yang dimasukkan belum benar. Periksa kembali isian Anda. | Zod rejected the input at a boundary, or a database check constraint fired |
| `UNAUTHENTICATED` | 401 | Sesi Anda sudah berakhir. Silakan masuk kembali. | No signed-in user |
| `PERMISSION_DENIED` | 403 | Anda tidak memiliki akses untuk tindakan ini. | The matrix said no, or RLS refused (SQLSTATE 42501) |
| `ORG_CONTEXT_MISSING` | 403 | Akun Anda belum terhubung ke organisasi mana pun. Hubungi admin. | Signed in, but no usable organisation |
| `NOT_FOUND` | 404 | Data yang Anda cari tidak ditemukan. | The row does not exist, or RLS hides it |
| `CONFLICT` | 409 | Data ini baru saja diubah orang lain. Muat ulang halaman lalu coba lagi. | Unique or FK violation, or an optimistic-lock miss |
| `AUDIT_REASON_REQUIRED` | 422 | Alasan wajib diisi untuk tindakan persetujuan atau override. | An override or approval reached the audit layer with no reason |
| `VARIATION_INVALID_TRANSITION` | 422 | Perubahan status untuk variation ini tidak diperbolehkan saat ini. | A change_orders transition was attempted that either doesn't exist in the state graph for the current status, or failed a guard (wrong actor role, or client_approve before cost/schedule impact were filled in) |
| `VARIATION_NOT_FUNDED` | 422 | Variation ini belum berstatus "dana masuk" -- pekerjaan belum bisa dibuka. | A work package tried to attach to a change order that isn't `approved_funded` yet |
| `LEAD_NOT_QUALIFIED` | 422 | Lead harus berstatus "qualified" sebelum bisa dikonversi menjadi proyek. | `convertLeadToProjectAction` called before the lead reached `qualified` |
| `LEAD_INVALID_TRANSITION` | 422 | Perubahan status untuk lead ini tidak diperbolehkan saat ini. | `updateLeadStatusAction`'s domain `transition()` refused the requested status change (no such edge in the pipeline graph) |
| `PROPOSAL_INVALID_TRANSITION` | 422 | Perubahan status untuk proposal ini tidak diperbolehkan saat ini. | `sendProposalAction` called on a non-draft proposal, or `decideProposalAction` called on a proposal that has not been sent yet |
| `INFRA_UNAVAILABLE` | 503 | Sistem sedang tidak dapat diakses. Coba beberapa saat lagi. | Supabase, storage, or the network failed |
| `RATE_LIMITED` | 429 | Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi. | Too many magic link requests |
| `INTERNAL_ERROR` | 500 | Terjadi kesalahan pada sistem. Tim kami sudah dicatat kejadiannya. | Anything uncategorised. An unexpected one in the logs is a bug, not a category |

## Three distinctions worth keeping

**`ORG_CONTEXT_MISSING` is not `UNAUTHENTICATED`.** Signing in again fixes the
second and cannot fix the first. Collapsing them sends a user with a suspended
account into a sign-in loop instead of to an administrator.

**`INTERNAL_ERROR` is not `INFRA_UNAVAILABLE`.** "Temporarily unavailable"
invites a retry. If the cause was a `TypeError` in our own code, that retry
fails identically forever. `asAppError` only classifies something as
infrastructure when there is evidence — a Postgres error code, or a network-layer
failure.

**`PERMISSION_DENIED` covers RLS refusals.** SQLSTATE 42501 means "you are not
allowed", not "the database is broken". Reporting it as a system failure sends
the user to the wrong person for help.

## What the user sees versus what is logged

ARCHITECTURE.md §5.1 rule 4 keeps these apart, and `AppError` has a field for
each: `userMessage` (Indonesian, safe for anyone including a client in the
portal) and `message` plus `meta` (technical, log only).

`toActionResult` only ever reads the user-facing side. That is what stops a
Supabase error naming `estimates.margin_amount` from reaching a client's screen,
and `safe-action.test.ts` asserts it with that exact scenario.

## Domain codes

Each phase adds its own as its rules are built. Declaring a code for a rule
that does not exist yet would be building ahead of the sequence (CLAUDE.md
law 7), and an unused code in a catalogue is indistinguishable from a rule
someone forgot to implement -- so this table only lists what a phase actually
added, not a roadmap.

**Fase 2 — Cash Gate** did not end up needing its own codes: the
override/block path goes through the database trigger's hinted
`check_violation`, which `asAppError` classifies as `VALIDATION_FAILED` and
surfaces verbatim (ADR 0015) — not a domain-level `Result` the action layer
translates (see ADR 0012's note on this gap). `evaluateGateAction` exists and
is unit-tested, but nothing in `modules/cash-gate/actions` calls it yet.

**Fase 3 — Scope & Variation** added `VARIATION_INVALID_TRANSITION` and
`VARIATION_NOT_FUNDED` above -- both wired into `modules/scope-variation`'s
domain `transition()` and consumed by its actions, following ARCHITECTURE.md
4.1's intended flow (`decision = domain.transition(...)`, mapped to an
`ActionResult` **before** any database write is attempted, rather than
letting the DB trigger's raised exception be the first thing the user sees).

Still pending their own phases: `CASH_GATE_RED`/`CASH_GATE_OVERDUE`/
`CASH_GATE_OVERRIDE_REQUIRES_REASON` (would need Fase 2's action layer
revisited to actually use them), `HOLD_POINT_PENDING`/
`HOLD_POINT_OVERRIDE_DENIED` (Fase 5).

**Fase 8 — CRM/Assessment/Estimating/Procurement** added `LEAD_NOT_QUALIFIED`
above, thrown directly by `convertLeadToProjectAction` -- deliberately
application-layer only, not a database trigger, since a lead's conversion
readiness is a workflow convenience gate, not a money or approval rule
(CLAUDE.md 0.3's two-layer requirement targets the latter). The margin-floor
warning (ADR 0018 SS4) needed no code at all: it is a UI-only advisory
number, never thrown, the same treatment Decision Clock (Fase 6) and the
aging tiers (Fase 7) already got.
