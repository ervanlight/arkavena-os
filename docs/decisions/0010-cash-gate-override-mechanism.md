# ADR 0010 — Cash Gate override: a dedicated table, valid for 5 minutes from creation

**Status:** Accepted — owner approved on 2026-07-21
**Date:** 2026-07-21
**Needs owner confirmation:** no (this ADR records the owner's own decision)

## Context

ARCHITECTURE.md 4.2 says the DB trigger blocks a red-gate action "kalau ...
tidak ada override record -- RAISE EXCEPTION", implying some persisted
record the trigger can check. No table for it is named anywhere in
ARCHITECTURE.md 2.1's migration wave list -- a fifth gap alongside the four
in ADR 0009, found while designing the trigger's actual SQL rather than
just its signature.

The design question underneath "what table" is really: how long does an
override stay valid? A row that permanently disables the gate check for a
project once created would mean one Owner click quietly turns off money
enforcement for that project forever, discovered only when someone asks
why a clearly-red project kept accepting work. A one-shot authorization
tied to the specific moment reads as what ARCHITECTURE.md 4.2 actually
describes: "override hanya valid dengan reason... hasil override SELALU
memicu audit entry" -- language about a deliberate act taken once, not a
standing exemption.

## Decision

`cash_gate_overrides` (Wave 7, owned by modules/cash-gate):

```
id, organization_id, project_id, action (text, matches evaluateGateAction's
action union), reason (not null), overridden_by (-> users, must resolve to
an Owner), created_at
```

The override server action inserts this row and performs the gated mutation
(e.g. the `work_packages` status update) in the same database transaction,
so the trigger sees the just-inserted override row under normal transaction
visibility rules -- no cross-transaction timing to reason about.

The trigger's check: does an override row for this `project_id` and this
`action` exist with `created_at` within the last 5 minutes? If yes, allow;
if no, `RAISE EXCEPTION` as before. 5 minutes is a named constant
(`OVERRIDE_VALIDITY_MINUTES`), mirrored in SQL the same way
`OVERDUE_GRACE_DAYS` (ADR 0009) already is.

Practically: an Owner clicking "override and proceed" authorizes exactly the
one action they are about to take, right now. It does not touch the gate's
status for any other action, any other moment, or any other project. Needing
to override again five minutes later, or for a different action, means
clicking again -- and a fresh audit entry each time, which is the intended
behaviour, not friction to work around.

## Consequences

**No standing "gate disabled" state exists anywhere in the schema.** Every
override is a fresh, timestamped, reasoned, audited event. Reading the audit
trail for a project answers "how many times, by whom, and why" precisely,
because there is nothing else an override could mean.

**A 5-minute window is a guess at how long a UI round-trip legitimately
takes, not a measured number.** If it turns out too short in practice (an
Owner reads the reason field, thinks for a while, and the override expires
before they click "confirm"), the fix is widening the constant, not
redesigning the mechanism -- low reversal cost either way.

## Alternatives considered

**An override that lasts until the underlying cash position changes.**
Rejected: requires the trigger to reason about *why* the gate is currently
red or overdue and whether that specific cause has been resolved, which is
substantially more logic for a benefit ("don't have to click twice in one
afternoon") that does not obviously outweigh the cost of a standing
exemption being harder to reason about later.

**No expiry at all -- an override authorizes that project+action forever
once granted.** Rejected outright: this is the "gate quietly disabled"
failure mode described in Context, and it directly contradicts
ARCHITECTURE.md 0.2's premise that money rules hold even when a human isn't
watching closely.
