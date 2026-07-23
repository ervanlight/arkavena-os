# ADR 0021 — Fase 10 scope reduction: voice-note and draft-weekly-report deferred

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (confirmed 2026-07-23)

## Context

ARCHITECTURE.md's Build Sequence names six features for Fase 10 (line 604-611)
and one hard checkpoint tied to a specific one of them:

> Voice note → draft daily report; draft weekly report; klasifikasi issue;
> ringkasan quote; draft assessment/proposal; deteksi keterlambatan.
> ...
> ── CHECKPOINT #5: review kualitas draft AI vs voice note nyata
>    berbahasa campuran Indonesia/Jawa dari lapangan. ──

ADR 0020 already flagged that voice-note needs a second AI vendor (a
speech-to-text provider — Claude does not transcribe audio) that
ARCHITECTURE.md's stack line doesn't name, and deferred it pending an
explicit Owner choice. F10-1 through F10-3 (this session) shipped the four
remaining text-only features — klasifikasi issue, deteksi keterlambatan,
ringkasan quote, and a draft-assessment-scope suggestion covering the
"assessment" half of "draft assessment/proposal" — each verified end to end
(unit, RLS, real-browser E2E) and each structurally incapable of approving
anything, per Fase 10's own exit criterion.

That leaves two things unresolved, surfaced to the Owner directly rather than
decided silently (CLAUDE.md §12):

1. **Voice-note is still undecided** — no STT vendor has been chosen. CHECKPOINT
   #5 explicitly requires reviewing AI draft quality against *real* mixed
   Indonesian/Javanese field audio, which cannot happen without the feature
   existing first. The checkpoint is therefore un-passable in this Fase 10
   pass.
2. **Draft weekly report has its own, separate blocker**: the client-portal
   weekly-report page (`(client-portal)/portal/[projectId]/laporan-mingguan`)
   is generated live from `vw_client_*` views with no staff-review or
   persistence step at all. Wiring an AI draft in there directly would let
   AI-generated content reach a client with zero human review — a structural
   violation of CLAUDE.md §9's "output AI selalu status draft, manusia
   mengedit & menyimpan," not just a rough edge.

The Owner was asked directly (not defaulted): both should be deferred rather
than either building an STT integration now or designing a client-portal
review-gate mid-phase.

## Decision

**Fase 10's shipped scope, for the Build Sequence's purposes, is four
features**: klasifikasi issue, deteksi keterlambatan, ringkasan quote, draft
assessment scope. Its exit criterion ("draft AI bisa diedit-simpan; tidak ada
jalur AI yang meng-approve pembayaran/kualitas/variation") is satisfied by
all four, verified explicitly (structural: no `ai-scribe` action writes to
any table it doesn't itself own; tested: `ai-scribe-actions.test.ts` and
`quote-summary-and-scope-draft-actions.test.ts` assert this directly).

**Voice-note → draft daily report, and CHECKPOINT #5, are deferred to a
future phase** — not scheduled, not blocking Fase 11. They resume only once
the Owner picks a speech-to-text vendor (Whisper API, Deepgram, AssemblyAI,
or otherwise), at which point a follow-up ADR covers that vendor's specific
integration (cost, data residency — audio leaves the server to a *third*
party, not just Anthropic — and the model/pipeline shape), and CHECKPOINT #5
is attempted against real field audio only after that feature exists.

**Draft weekly report is deferred** alongside it, pending a separate design
decision on how a human reviews an AI-drafted weekly report before it can
reach the client-portal page — out of scope for this ADR to solve, since it
requires designing a new review/save step for a page that currently has
none.

Both deferrals are treated exactly like ADR 0020's original voice-note
deferral: nothing was started, so reversal cost is zero, and nothing here
blocks Fase 11 (Partner Desk), which does not depend on either.

## Consequences

**What this makes easy:** Fase 10 can be honestly marked "done for its
reduced scope" and the Build Sequence can proceed to Fase 11 without a
half-built voice/weekly-report feature sitting in an ambiguous state.

**What this accepts as a cost:**

- SiteFlow staff keep typing daily logs by hand — voice input, the single
  biggest ergonomic win Fase 10 promised, does not ship until a follow-up
  ADR names an STT vendor.
- Weekly reports stay fully auto-generated from `vw_client_*` views with no
  AI narrative layer, until a review-gate design exists.
- CHECKPOINT #5 remains formally un-passed. This ADR does not waive it —
  it is deferred to whichever future ADR ships voice-note, at which point the
  Owner still does the real review against real field audio before that
  feature (not this one) is considered done.

**Reversal cost:** zero — both features were never started under this ADR;
resuming either is a fresh follow-up ADR, not an undo.

## Alternatives considered

- **Build voice-note now against a default-picked STT vendor**: rejected —
  same reasoning as ADR 0020 Decision 6; a second AI vendor is a cost/
  data-residency decision for the Owner, not a default to bury in scope
  paperwork.
- **Waive CHECKPOINT #5 entirely instead of deferring it**: rejected — the
  checkpoint exists to catch exactly the failure mode of AI drafts that look
  fine on clean English test data but fall apart on real mixed-language
  field input; waiving it outright (rather than deferring it to when the
  feature it reviews actually exists) would mean nothing ever checks that.
- **Design the weekly-report review gate immediately to unblock the
  feature this same round**: rejected for this round — it is a real UI/data
  flow decision (what does "draft, pending staff review" look like for a
  page currently generated with zero persisted drafts?) that deserves its
  own considered round, not a rushed addition to an ADR about scope
  bookkeeping.
