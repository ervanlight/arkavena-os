# ADR 0020 — Fase 10 (AI Scribe): lifting the D7 freeze, and scope decisions

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (confirmed 2026-07-23)

## Context

Owner decision D7 (ARCHITECTURE.md §9) froze `modules/ai-scribe` entirely — no
Claude API calls, no stubs, no prompt templates, no API key env var, no SDK
dependency, anywhere in the repo — until the Owner asked for it explicitly.
That happened this session. Per ARCHITECTURE.md's own revision rule ("Revisi
keputusan" — D1-D10 changes need an ADR + a §9 update + explicit approval),
this ADR is that paperwork, and also resolves the scope questions Fase 10's
one-paragraph description leaves open.

Fase 10's exit criterion (ARCHITECTURE.md §7):

> "Exit: draft AI bisa diedit-simpan; tidak ada jalur AI yang meng-approve
> pembayaran/kualitas/variation/status keselamatan (dites eksplisit)."

Six features are named, in one sentence each, no schema, no data flow:
*voice note → draft daily report; draft weekly report; klasifikasi issue;
ringkasan quote; draft assessment/proposal; deteksi keterlambatan.* Building
straight from that would mean inventing six features' worth of data model and
a first-ever external-API integration in one pass — the same situation ADR
0018/0019 resolved for their own phases, addressed the same way here.

One thing surfaced immediately while scoping this that needs flagging before
anything else: **Claude does not transcribe audio.** It is a text-and-image
model. "Voice note → draft daily report" needs a speech-to-text step from
*some* vendor before Claude ever sees text to draft from — and
ARCHITECTURE.md's own stack line names only "Claude API (server-side)", no
second AI vendor. This is a real scope expansion, not a detail to paper over
silently (see Decision 6).

## Decision

### 1. `@anthropic-ai/sdk`, called only from `modules/ai-scribe/actions/`, `safeAction`-wrapped like everything else

No Route Handler under `src/app/api/` (currently empty — confirmed nothing in
this codebase uses one yet, including Fase 4's own file-upload flow, Decision
2 below). CLAUDE.md §4's `safeAction` pattern is "WAJIB" for every mutation
already; an AI generation is a mutation (it costs money and gets logged) with
a text result instead of a database row. Streaming isn't needed for any of
the six features — a daily-log-length or proposal-length draft returns in one
round trip. Model: `claude-haiku-4-5` for the mechanical/classification
features (issue classification, delay detection, quote summary — cheap,
fast, no real judgment needed), `claude-sonnet-5` for the two drafting
features that need to sound like a coherent report (daily/weekly report
drafts, assessment/proposal drafts) — same "cheaper model for mechanical
work, better model for anything a human reads as prose" split already
implicit in how this project treats computed-advisory-numbers vs.
judgment calls.

### 2. AI never writes business data. It returns suggested text; a human saves it through the feature's own existing action, unchanged

This is the mechanism that makes the exit criterion's "tidak ada jalur AI
yang meng-approve..." true *structurally*, not by convention: `ai-scribe`
owns no table that any other module already owns, and none of its actions
call `insertX`/`updateX` on `daily_logs`, `issues`, `assessments`, `proposals`,
or anything else. A `generateDailyLogDraftAction` returns a plain string (or
a small structured object matching the create-form's own fields); the UI
pre-fills `CreateDailyLogForm` with it; the user reviews, edits, and submits
through `createDailyLogAction` — the same action, same permission check, same
audit trail that already exists, completely unaware anything upstream of it
was AI-assisted. No new `status = 'draft'` column needed anywhere: the
"draft" *is* the unsaved form state in the browser, gone if the user
navigates away without submitting. This also means **no client-facing
approval action anywhere in this codebase needs to change** — `invoice.issue`,
`inspection.override`, `change_orders`' transitions, all keep working
exactly as today, immune to this phase by construction rather than by a
rule someone has to remember to enforce.

### 3. `ai_generations`: the one new table, existing purely to log cost and prove the "never approves" rule under test

```
ai_generations
  id, organization_id, project_id (nullable -- some features, e.g. quote
    summary, are project-scoped; a future org-wide feature might not be),
  feature (text: 'daily_log_draft' | 'weekly_report_draft' |
    'issue_classification' | 'quote_summary' | 'assessment_proposal_draft' |
    'delay_detection'),
  model (text), input_tokens (integer), output_tokens (integer),
  cost_amount (bigint, Rupiah -- CLAUDE.md law 0.1, converted from the
  provider's USD-per-token pricing at a fixed rate constant, same "give it
  a concrete number, flag it for the owner to adjust" treatment as the
  warranty duration default, ADR 0019 SS3), requested_by (uuid, users),
  created_at
```
Staff-only RLS, same shape as every other Fase 8/9 table. No `deleted_at` --
this is an append-only cost ledger, not an editable business record (same
reasoning `audit_logs` itself already uses).

### 4. A hardcoded per-organization monthly budget cap for v1, checked before every call

`AI_MONTHLY_BUDGET_CAP = Rp 300.000` (a placeholder number, not a researched
one -- flagged here explicitly for the Owner to correct), checked as
`sum(cost_amount) this calendar month for this organization_id >= cap` before
any Claude API call is made. Over cap: the action returns a clean
`ActionResult` error (`AI_BUDGET_EXCEEDED`, a new error code), not a thrown
exception -- same "domain layer answers, doesn't throw" shape as every other
business rule. No per-project cap in v1 (the exit criterion says "log biaya
per proyek", not "batasi biaya per proyek" -- logging per project is
Decision 3's `project_id` column; capping is deliberately org-wide only, to
avoid needing a UI for setting a limit per project before any real usage
data exists to size it from).

### 5. Sensitive data boundary: prompts are assembled server-side from data already loaded through each module's own repository, never forwarded raw from the browser

CLAUDE.md §9's "data sensitif tidak dikirim dari browser langsung ke API" is
enforced structurally the same way Decision 2 enforces "never approves":
every `ai-scribe` action's input schema takes an **id** (a daily log id, an
issue id, a vendor quote id), not free-form content -- the action itself
calls the owning module's own read action/repository to fetch the record
server-side, builds the prompt from that, and the browser never has a code
path that lets it stuff arbitrary text into a Claude prompt. This also means
each `ai-scribe` action necessarily imports the *owning* module's public API
(`@/modules/field-reporting`, `@/modules/procurement`, ...) to read source
data -- same "another module's public API, never its repository" rule as
`convertLeadToProjectAction` reaching into `modules/projects` (ADR 0018 SS2).

### 6. Scope for this increment: the four text-only features, not all six

Voice-note transcription needs a second AI vendor decision (Whisper API,
Deepgram, AssemblyAI, or Claude-via-some-future-audio-capability) that
ARCHITECTURE.md's stack line does not cover and this ADR should not decide
unilaterally -- picking a transcription vendor has real, ongoing cost and
data-residency implications (audio leaves the server to a *third* party, not
just Anthropic) that deserves its own explicit Owner decision, not a default
buried in an ADR about something else. **Voice note → draft daily report is
therefore deferred to its own follow-up ADR**, once the Owner picks a
transcription vendor (or decides text-only daily log entry is fine and this
feature isn't worth the second vendor at all).

Draft weekly report and draft assessment/proposal are both real drafting
tasks (multi-paragraph prose synthesizing several source rows each) --
higher-value but also higher-risk-of-a-bad-draft than the other two, and
worth their own round of use before committing to a UI shape. Deferred to a
follow-up round within this same phase (F10-2), after the two simplest,
lowest-risk, most mechanical features prove the whole pipeline
(SDK call → cost log → budget cap → draft returned → human saves via the
existing action) end to end:

- **Klasifikasi issue** (`issue_classification`): given an `issues` row's
  free-text description, suggests a `severity` (existing enum) and a short
  category tag. Purely advisory -- `updateIssueAction` already lets staff set
  severity manually; this just pre-fills a suggestion.
- **Deteksi keterlambatan** (`delay_detection`): given a project's
  `work_packages`/`milestones` due dates vs. today, flags which are at risk
  and drafts one sentence explaining why, for a human to review on the
  project dashboard. Advisory only, writes nothing.

**Ringkasan quote** (`quote_summary`, summarizing a `vendor_quotes` row plus
its sibling quotes for the same `material_request` into a short comparison)
is the natural third, but is deferred to F10-2 alongside the two drafting
features rather than bundled into F10-1, keeping the first increment to
exactly the two features with zero cross-quote comparison logic to design --
proving the pipeline before adding that shape of complexity.

## Consequences

**What this makes easy:** every mechanism reuses a shape this codebase has
already validated -- `safeAction` + `recordAudit`-adjacent cost logging (a
new table, same append-only/staff-only shape as a dozen before it), a
hardcoded default flagged for owner correction (margin floor, warranty
duration, now the budget cap), reading another module only through its
public API. The "AI never approves" guarantee costs nothing to maintain
going forward because it's architectural (no table ai-scribe can write to
even exists for any of the gated actions), not a checklist item.

**What this accepts as a cost:**

- **Voice note → draft daily report does not ship in this phase's first
  increment.** SiteFlow staff keep typing daily logs by hand until a
  transcription vendor is chosen. This is the single biggest piece of
  Fase 10's stated value (voice input from the field is the whole point for
  a mandor who doesn't want to type) deliberately left out, not an oversight.
- **A guessed budget cap number** (Rp 300.000/month) with no real usage data
  behind it -- likely wrong in one direction or the other; cheap to correct
  once real cost-per-generation numbers exist (F10-1's own manual
  verification against real Claude API calls will produce the first real
  data point).
- **Draft weekly report and draft assessment/proposal wait for F10-2.** Both
  are genuinely higher-value than issue classification, but also the two
  most likely to produce a draft bad enough to erode trust in the whole
  feature on first use -- worth getting issue classification/delay detection's
  pipeline right and cheaply verified first.

**Reversal cost:** low. `ai_generations` is purely additive and owned
entirely by this module; nothing else depends on its shape. The budget cap
constant is a one-line change. Deferring voice-note/weekly-report/proposal-
draft costs nothing to reverse later -- they were never started.

## Alternatives considered

- **A generic `ai_drafts` table storing every feature's suggested content**,
  with a `status` column a human flips to `'saved'`: rejected (Decision 2) --
  this would mean building a second, parallel "review and save" UI/data flow
  for six features that already each have a perfectly good create/update
  form and action; pre-filling the existing form with AI-suggested values is
  strictly less code and reuses six modules' existing validation instead of
  re-implementing it against a generic draft blob.
- **Route Handlers under `src/app/api/ai/`** instead of `safeAction`-wrapped
  server actions: rejected (Decision 1) -- no technical requirement (no
  streaming, no webhook, no non-Next-client caller) justifies deviating from
  CLAUDE.md §4's mandatory pattern, and `src/app/api/` currently has zero
  precedent to follow even for the closest analogous case (Fase 4's photo
  upload, which itself uses a server action for its metadata step).
- **Picking a transcription vendor now** (e.g. defaulting to Whisper) to ship
  all six features in one pass: rejected (Decision 6) -- a second AI vendor
  is a cost/data-residency decision ARCHITECTURE.md's stack line doesn't
  cover, and choosing one silently inside an otherwise-unrelated ADR is
  exactly the "decided quietly mid-coding" failure mode ARCHITECTURE.md's own
  opening line warns against.
- **Per-project budget caps instead of org-wide**: rejected (Decision 4) for
  this increment -- no usage data yet to size a sensible per-project number
  from, and the exit criterion only asks for per-project *logging*, which
  `ai_generations.project_id` already gives for free.
