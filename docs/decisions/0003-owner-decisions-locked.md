# ADR 0003 — The ten open architecture questions are answered and locked

**Status:** Accepted
**Date:** 2026-07-20
**Needs owner confirmation:** no (this ADR records the owner's own decisions)

## Context

ARCHITECTURE.md v0.1 shipped with ten unresolved questions in §9. They were
unresolved on purpose: each one changes the shape of the Wave 0–1 migrations or
the kernel, and guessing at them would have produced a foundation built on
assumptions nobody agreed to.

The owner answered all ten on 2026-07-20, before any code was written.

## Decision

The answers are recorded in full, with their technical consequences, in
ARCHITECTURE.md §9 as D1–D10. That section is now the contract; this ADR exists
so the *event* — that these were decided deliberately and when — is in the
decision log rather than only in a document revision.

Summary, with the consequence that most affects day-to-day code:

| | Decision | What it forces |
| --- | --- | --- |
| D1 | Multi-tenant-ready from day one | `organization_id` on every table, from the first migration |
| D2 | Supabase Storage, client-side compression to 200–400KB | ~3,000-photo practical ceiling; usage must be monitored, not assumed |
| D3 | Offline: read cache + outbox, last-write-wins per field | Outbox stores per-field mutations, not row snapshots |
| D4 | Auth: email magic link for every role | No SMS/WhatsApp provider anywhere in the kernel |
| D5 | Cash source: manual entry by Finance | Every `cleared_at` and amount change must be audited |
| D6 | IDR, `bigint`, no tax calculation | No tax columns in any schema until this is revised |
| D7 | `ai-scribe` frozen | No AI calls, stubs, prompts, keys, or SDKs anywhere in the repo |
| D8 | E-signature deferred | Scanned uploads only |
| D9 | Vercel Hobby + Supabase Free | Free-tier limits are a design constraint, not a footnote |
| D10 | Indonesian UI, English code, no i18n | Indonesian strings inline; no translation framework |

## Consequences

The decisions with teeth are D1, D6, and D7, because each forbids something that
is otherwise the natural thing to do.

**D1** costs one column and one policy per table now. Retrofitting tenancy onto a
populated schema later would mean backfilling every row and rewriting every
policy, with a live database. Cheap now, very expensive later — which is exactly
why it is being paid now.

**D6** forbids "preparing" tax columns. A nullable `tax_amount` that nothing
writes to looks harmless and is not: it invites half-implementations, and a
column that is sometimes populated is worse than one that never is.

**D7** is the one most likely to be violated by accident, because a stub feels
like progress rather than a breach. It is written as a hard prohibition in
CLAUDE.md §9 and in `src/modules/ai-scribe/README.md` for that reason.

**D4** carries a real product risk, recorded here so it is not forgotten: magic
link assumes every site supervisor has an email account they can open on their
phone. That assumption is untested against actual field conditions and does not
get tested until CHECKPOINT #3 (Fase 4 field trial). If it fails there, it is an
architecture revision, not a patch.

**D9** means free-tier limits are a design constraint. Any decision that pulls a
limit closer must be raised with the owner explicitly; an upgrade is never to be
assumed.

## Alternatives considered

Not applicable — this ADR records decisions made by the owner rather than
proposing one. The alternatives for each individual question are in
ARCHITECTURE.md §9 v0.1, preserved in this repository's git history.
