# ADR 0024 — Fase 11 (Partner Desk) scope decisions

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (proceeding per explicit Owner instruction to
build Fase 11 now without stopping for further confirmation on scope calls
within it; genuinely new money/security/data-leak risks are still called out
below rather than decided silently, per that same instruction)

## Context

ARCHITECTURE.md's Fase 11 entry is one line with no schema, no exit
criterion, no checkpoint number — the least specified phase in the Build
Sequence:

> FASE 11 — Partner Desk + polish: supplier quotes/delivery/invoice
> terbatas; notifikasi WA API sesuai dokumen.

Same situation ADR 0018/0019/0020 each resolved for their own phase: building
straight from one sentence means inventing the actual data model and scope.
Six concrete ambiguities surfaced while scoping this one, resolved below.

## Decisions

### 1. Scope this pass: supplier only, not subcontractor

The folder structure comment (`(partner-desk)/ # /partner/* — Supplier,
subcontractor`) and D1's role list both name `subcontractor` alongside
`supplier`, but Fase 11's own feature line ("supplier quotes/delivery/
invoice") names only supplier-shaped data, which maps cleanly onto
modules/procurement's existing tables (`vendor_quotes`, `purchase_orders`,
`deliveries`). No `subcontractors` business entity table exists anywhere in
the schema, and no table has a subcontractor-assignment column (`work_packages`
has none) — there is nothing concrete for a subcontractor view to read.
Inventing that entity and an assignment mechanism is a real, separate design
task, not implied by the one line naming quotes/delivery/invoice. **Deferred**
to a future ADR once a subcontractor data model is actually needed — noted in
`docs/PRE-LAUNCH-CHECKLIST.md` as a scope gap, not a risk.

### 2. "Invoice terbatas" = the quote/PO amount itself, not a new invoice workflow

No supplier-invoice-submission or payment-approval workflow is named or
implied anywhere else in this document, and building one (a supplier
submitting an invoice, staff reviewing/approving it, a payment-status state
machine) is a materially bigger feature than "terbatas" (limited) suggests.
Interpreted narrowly: suppliers see the `amount` already on their own
`vendor_quotes`/`purchase_orders` rows — the commercial commitment record
that already exists — nothing new is added to track payment status. A real
invoice-submission flow, if ever needed, is future scope with its own ADR.

### 3. Read-only in v1 — no self-service quote submission

Staff continues to enter `vendor_quotes` on a vendor's behalf (unchanged from
ADR 0018). Partner Desk gives suppliers visibility, not a write path. A
supplier submitting their own quote is a real feature with its own validation/
review-queue questions, not implied by "terbatas."

### 4. WhatsApp API notifications: deferred, not built this pass

`notifications`' own migration comment already states the reasoning this
inherits: *"In-app and email only (owner decision D4/D9: no paid WhatsApp
channel at this stage)"* — "at this stage" meaning revisit later, and later is
now. But choosing a WhatsApp provider (Meta Cloud API direct, Twilio, a
broker like Wati/Gupshup) is a **real recurring per-message cost plus a new
external vendor** receiving phone numbers and message content — the same
category of decision ADR 0020 refused to make unilaterally for a
speech-to-text vendor. CLAUDE.md's own standing instruction is explicit that
money decisions like this are not something to decide quietly mid-build, even
under an instruction to keep going without stopping for routine scope calls.

**Decision:** Partner Desk ships using the existing in_app notification
channel only (`notifications` table already supports any `users` row
regardless of `org_role`, including external roles — zero new
infrastructure). No `notification_channel` enum value is added for
`whatsapp`, and no dispatch-adapter scaffolding is built ahead of a vendor
choice — CLAUDE.md's own instruction against speculative/half-finished
abstractions applies here the same as anywhere else. Noted in
`docs/PRE-LAUNCH-CHECKLIST.md`, cross-referencing this decision, as something
that needs an explicit Owner vendor/budget choice before it can ship.

### 5. Supplier identity: a new `vendor_users` table, mirroring `client_users`

`project_members` links a user to a project and a role, but not to *which*
vendor they represent — necessary here because two different suppliers can
both be `supplier` members of the same project, and RLS must tell their rows
apart. `client_users` (client_id ↔ user_id) is the direct precedent, though
notably it turned out unused in practice (client-portal resolves project
access via `project_members` alone, since a client only ever needs "which
project," not "which client"). Suppliers are different: `vendor_quotes`/
`purchase_orders`/`deliveries` are scoped by both `project_id` *and*
`vendor_id`, so the vendor identity link is load-bearing here, not
speculative scaffolding repeating `client_users`' fate.

New RLS-gated SELECT policies are added to `vendor_quotes`, `purchase_orders`,
and `deliveries` (additive — Postgres RLS policies are OR'd, so this changes
nothing about existing staff-only access): a supplier sees a row only if
`fn_has_project_role(project_id, ARRAY['supplier'])` **and** their
`vendor_users` row's `vendor_id` matches the row's `vendor_id` (deliveries
joins through its `purchase_order_id`). Three new `security_invoker = true`
views (`vw_partner_vendor_quotes`, `vw_partner_purchase_orders`,
`vw_partner_deliveries`) expose a partner-safe column subset — excluding
internal `notes` and internal staff-user references (`issued_by`,
`received_by`) — the same "no raw internal table access, views only" rule
ARCHITECTURE.md 2.6 already applies to the client portal.

### 6. Supplier account provisioning: a real gap, fixed here, generalised for reuse

No UI or action anywhere in this codebase (across all ten prior phases)
actually provisions an external project-role user — `client_users`,
`project_members` rows for `client_approver`/`mandor`/etc. have only ever
been created by test factories using the service-role client directly.
`core/db/admin.server.ts` was written from Fase 1 anticipating exactly this
("provisioning a user, which must write a row before that user has a
session") but nothing ever called it. Partner Desk cannot be a real, usable
feature without a way to actually create a supplier's login — so this phase
adds `core/auth/provision-external-user.ts` (a small, reusable, service-role
helper: creates the `auth.users` row if it does not already exist, then the
`users` row with `org_role = null`), and a procurement-owned
`inviteVendorUserAction` that calls it plus writes `vendor_users` and
(optionally) a `project_members` row for a given project. This is scoped as
a supplier-specific action for now; the same `provision-external-user.ts`
helper is written to be reusable for client/mandor onboarding UI later
without redesign, but building that UI for the other roles is out of scope
here. Noted in `docs/PRE-LAUNCH-CHECKLIST.md` as a completeness gap that
predates this phase and still isn't closed for any role but supplier.

## Consequences

**What this makes easy:** Partner Desk reuses every mechanism this project
has already validated — `security_invoker` views (Fase 6), additive RLS
policies (never touching existing staff policies), `safeAction` with no
`permission` entry for pure view-reads (client-portal's own precedent), the
service-role client for provisioning exactly as `admin.server.ts`'s own
docstring anticipated.

**What this accepts as a cost:** subcontractors, WhatsApp notifications, and
self-service quote submission all ship as explicitly deferred rather than
built — each is a real, separate design task this ADR declines to invent
speculatively. Client/mandor onboarding UI remains as absent after this ADR
as before it; only the supplier path gets a real invite flow this round.

**Reversal cost:** low for all deferred items — nothing is started, so each
is a normal future-phase kickoff via its own ADR, not an undo.

## Alternatives considered

- **Build subcontractor support now too, guessing at a work-assignment
  column**: rejected — inventing a business entity and schema with no
  concrete feature description to build against is exactly the kind of
  silent architectural decision CLAUDE.md §12 warns against, worse than
  deferring it visibly.
- **Pick a WhatsApp vendor by default (e.g., Twilio, the most commonly
  integrated) to ship the notification feature as literally named**:
  rejected — real recurring cost + a new external vendor receiving contact
  data is squarely the kind of money decision this session's own standing
  instructions carve out as a required stop, not a default to reach for.
- **Reuse `client_users`' exact (currently unused) shape without checking
  whether it's actually load-bearing for suppliers**: rejected after
  checking — for clients it turned out unnecessary (project_members alone
  sufficed), but for suppliers the vendor-identity join is genuinely required
  by the RLS design, so building `vendor_users` here is not repeating a
  mistake, it is a different, necessary case.
