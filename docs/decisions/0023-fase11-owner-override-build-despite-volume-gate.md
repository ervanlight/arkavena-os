# ADR 0023 — Fase 11 built now, overriding ADR 0022's volume gate

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (this ADR *is* that confirmation)

## Context

[ADR 0022](0022-fase11-deferred-pending-real-partner-volume.md), written
earlier the same day, deferred Fase 11 (Partner Desk) on the grounds that its
Build Sequence entry conditions it on real supplier/subcontractor transaction
volume ("bila volume sudah tinggi"), and the Owner confirmed that volume does
not exist yet.

The Owner has since explicitly instructed continuing through Fase 11 now,
without stopping to wait for further confirmation, as part of completing the
documented Build Sequence end to end. This is not a retraction of ADR 0022's
underlying fact — real partner volume still does not exist — it is a
deliberate choice to build the phase's code and infrastructure ahead of that
volume anyway, understanding the distinction ADR 0022 itself already drew
between "the code is built" and "the business condition that would make going
live with real partners appropriate."

## Decision

**Build Fase 11 now.** `modules/partner-desk` gets its full scope per
ARCHITECTURE.md §7 (supplier quotes/delivery/invoice limited, WhatsApp API
notifications), with its own scope-decisions ADR the same way Fase 8/9/10
each got one before implementation began.

**ADR 0022's factual premise is unchanged and still true**: no real partner
volume exists in BuildTrust OS's actual usage today. What changes is what
that fact is allowed to block. ADR 0022 is not deleted or edited — it stands
as the record of the volume condition and the Owner's first-pass decision to
wait; this ADR records the Owner's later, explicit decision to proceed with
building the phase regardless, the same "amend visibly, keep the prior
decision as history" treatment D7's unfreeze (ADR 0020) and Fase 10's own
scope reduction (ADR 0021) already used.

**This does not change ADR 0022's implicit warning about going live**: Fase
11 shipping in this Build Sequence pass means the code exists, is tested, and
is deployable — it does not mean real suppliers/subcontractors should be
invited to use it before the volume that would justify a partner-facing
surface actually exists, and before the items in
`docs/PRE-LAUNCH-CHECKLIST.md` are closed. Building ahead of demand is a
choice about engineering readiness; inviting real external partner users in
is a separate, later go-live decision this ADR does not make.

## Consequences

**What this makes easy:** BuildTrust OS's full documented scope (Fase 0-11)
exists in one consistent Build Sequence pass, ready for whenever partner
volume does materialize, rather than requiring a second multi-session build
effort picked up cold at that point.

**What this accepts as a cost:** Partner Desk code sits unused by any real
supplier/subcontractor until the business actually needs it — the same
"built ahead of proven need" tradeoff ADR 0022 originally argued against,
now accepted deliberately rather than by default.

**Reversal cost:** N/A — this is a decision to proceed, not a reversible
setup. If partner volume never materializes, the cost already paid is the
build time itself; nothing about shipping this phase creates ongoing
maintenance burden beyond what any other shipped module already carries.

## Alternatives considered

- **Leave ADR 0022 in place, stop, wait for the Owner to reopen the
  question later**: rejected — the Owner gave an explicit, direct
  instruction to proceed now; treating an earlier AskUserQuestion answer as
  more authoritative than a later explicit instruction in the same
  conversation would be honoring process over the Owner's actual, current
  intent.
- **Silently edit ADR 0022 to say Fase 11 is not deferred**: rejected —
  same reasoning as every other amendment in this project's history
  (D7's unfreeze, Fase 10's scope note): decisions get amended visibly, with
  the prior state preserved, not rewritten as if it never happened.
