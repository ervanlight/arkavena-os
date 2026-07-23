# ADR 0022 — Fase 11 (Partner Desk) deferred pending real partner volume

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (confirmed 2026-07-23)

## Context

ARCHITECTURE.md's Build Sequence gates every phase 0-10 purely on the
previous phase's exit criteria being green in CI (§7's "Aturan antar-fase").
Fase 11 is worded differently:

> FASE 11 — Partner Desk + polish (setelah internal stabil, supplier
> quotes/delivery/invoice terbatas; notifikasi WA API sesuai dokumen)
> bila volume sudah tinggi.

"Setelah internal stabil" is a technical condition — true now that Fase 0-10
are built and green. **"Bila volume sudah tinggi"** is not: it is a real
supplier/subcontractor transaction-volume threshold in BuildTrust OS's actual
usage, something no CI run or exit criterion can attest to. Building Partner
Desk (a supplier/subcontractor-facing portal plus WhatsApp API notifications)
before that volume exists would be exactly the "dibangun karena sekalian"
CLAUDE.md law 0.7 warns against — a phase built because the previous one
finished, not because its own stated precondition is true.

The Owner was asked directly whether that volume condition holds today. It
does not.

## Decision

**Fase 11 is not started.** Fase 0 through Fase 10 (the latter in its
ADR 0021-reduced form) constitute BuildTrust OS's complete, deployable core
product for this Build Sequence pass. `modules/partner-desk` (referenced in
ARCHITECTURE.md §1.1's folder structure) remains an empty placeholder
directory only, same treatment `modules/ai-scribe` had under D7 before its
own unfreeze — no migration, no schema, no code.

This is not a technical blocker and not a "phase failed its exit criteria"
situation — every prior phase's CI is green. It is a deliberate hold on
starting a phase whose own stated precondition (real partner volume) is not
yet met. A future session should re-check that condition against actual
usage before beginning Fase 11, not treat "all prior phases are green" alone
as license to start it.

## Consequences

**What this makes easy:** the codebase stays exactly as large as the
business currently needs. No unused supplier-portal auth surface, no
WhatsApp API integration (a real per-message cost and a second external
vendor, same category of decision ADR 0020 treated speech-to-text with) sits
half-used waiting for partners who aren't there yet.

**What this accepts as a cost:** if partner volume grows before anyone
revisits this ADR, Partner Desk isn't ready to hand suppliers/subcontractors
their own portal on short notice — building it is a fresh multi-session
effort at that point, the same size of work Fase 8/9/10 each were.

**Reversal cost:** zero to defer further, low to start — nothing was begun,
so starting Fase 11 later is a normal next-phase kickoff (an ADR scoping its
specific data model and WA API integration, same pattern as ADR 0018/0019),
not an undo of anything.

## Alternatives considered

- **Build Fase 11 now regardless of volume**: rejected — the phase's own
  wording conditions it on real usage data that does not exist yet; building
  ahead of that is speculative scope, not "next in the Build Sequence."
- **Build a minimal/stub version now to "have something"**: rejected —
  CLAUDE.md law 0.7 and this project's own stated build philosophy
  (§7: "semua dibangun, tapi tidak ada yang dibangun di atas fondasi yang
  belum terbukti") argues against building on an unproven need the same way
  it argues against building on an unproven foundation.
