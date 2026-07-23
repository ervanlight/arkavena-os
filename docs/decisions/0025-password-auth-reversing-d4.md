# ADR 0025 — Sign-in moves from magic link to email + password, reversing D4

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (this ADR *is* that confirmation — the Owner
requested this reversal directly, after being asked to confirm it was a
deliberate UX preference and not a workaround for the SMTP rate-limit bug
encountered earlier the same session)

## Context

ARCHITECTURE.md §9 D4 locked magic-link sign-in for every role, for one
reason stated explicitly: OTP/SMS costs money per message, and D4 chose the
zero-cost path. CLAUDE.md §0 rule 8 names D4 as one of the decisions "most
tempting to violate" and states violating it is an architecture revision, not
an implementation choice. `docs/PRE-LAUNCH-CHECKLIST.md` item 2 additionally
holds CHECKPOINT #3 open specifically to field-test whether magic link works
for site supervisors before any change to D4 is made.

Neither of those conditions is what triggered this ADR. The Owner asked for
this because they want the same id+password UX their other internal
dashboard already uses -- confirmed directly, not inferred, via an explicit
question that offered the SMTP-bug and field-adoption-difficulty
explanations as alternatives and asked the Owner to pick. Both would have
kept magic link and pointed at a different fix (an SMTP vendor; the
CHECKPOINT #3 field test itself). The Owner picked "I prefer id+password like
the other dashboard" -- a real, deliberate UX preference, which is exactly
the category CLAUDE.md §12 says gets written as an ADR and confirmed, not
decided quietly.

CHECKPOINT #3 (the field test) is not superseded by this ADR: it still
matters for a different reason (site-supervisor UX in general, not
specifically the magic-link mechanism). It stays open in
PRE-LAUNCH-CHECKLIST.md, re-scoped to "does password-based sign-in work in
the field" rather than "does opening an emailed link work in the field."

## Decision

**Every role signs in with email + password** (Supabase Auth's built-in
`signInWithPassword`), replacing `signInWithOtp`. No schema change:
`auth.users.encrypted_password` already exists and was simply unused before.

Six concrete decisions this implies:

### 1. No self-service sign-up -- provisioning still creates the account

D1's provisioning model is unchanged: an account is created by an owner (for
staff) or by `provisionExternalUser` (for clients/suppliers/subcontractors),
never by the person themselves arriving at a sign-up form. What changes is
that provisioning now also sets an **initial password**, generated
server-side (`core/auth/generate-temporary-password.ts` -- a 12-character
string from an alphabet with visually-ambiguous characters removed, so it
survives being read aloud or relayed over WhatsApp/SMS by a staff member, the
realistic handoff channel here, not email). The generated password is
returned once, in the action's result, for the inviting staff member to see
and relay -- never emailed, since SMTP is already a known constraint
(PRE-LAUNCH-CHECKLIST item 3) and this removes password delivery from that
dependency entirely for the common case.

### 2. Staff invitation is a real feature now, not just test factories

`core/permissions/matrix.ts` already reserved `user.invite` (owner-only) from
Fase 0, but no action ever implemented it -- every org_role user in this
codebase to date was created directly against `auth.users`/`public.users` by
seed SQL or test factories using the service-role client. Password auth makes
this gap concrete: there was no path for a real Owner to create a second real
staff account. `core/auth/invite-staff-user.ts` closes it, mirroring
`provisionExternalUser`'s shape (create-or-reuse by email, generate a
password, return it once) but assigning an `org_role` instead of leaving it
null, and gated by the existing `user.invite` permission entry.

### 3. Forgot-password still needs email -- kept, scoped down

Removing the password entirely (a client/supplier forgetting a password
relayed once by WhatsApp weeks ago is a real, expected case) requires some
recovery channel, and email is the only one this system has
(`notifications`' own migration comment: in-app + email only, D4/D9). Kept:
`requestPasswordReset` (`supabase.auth.resetPasswordForEmail`) plus a
`/reset-password` page that reuses the existing `/auth/callback` PKCE
exchange (a Supabase recovery link verifies through the identical `code`
param mechanism a magic link used, so the route needed no new logic, only an
updated doc comment). This is a narrow surface -- forgotten-password
frequency, not every sign-in -- so it does not reopen the SMTP-volume problem
signing in via magic link did.

### 4. Default-landing routing moves from `/auth/callback` to `/`

`/auth/callback`'s own `resolveDefaultLanding` (deciding `/cc` vs `/site` from
`orgRole`/project roles) existed there because magic link's redirect always
passed through that route. Password sign-in does not pass through any
redirect URL -- the browser stays on `/login` and gets a session directly --
so that logic is moved to `src/app/page.tsx` (the root route), which both the
login form (`router.push('/')` on success) and `/auth/callback` (no explicit
`next`) now redirect to. One shared place instead of two, and it incidentally
fixes a real pre-existing bug: root `page.tsx` and `/login`'s own signed-in
redirect both unconditionally sent every visitor to `/cc`, which a
site_coordinator/mandor (org_role null) has no permission to see anything on
-- never reachable through magic link's own flow (which always passed an
explicit `next`), but directly reachable now that a signed-in user can just
navigate to `/`.

### 5. Password minimum: 8 characters, no other complexity rule

Supabase Auth's own default minimum. Adding an org-configurable password
policy (rotation, complexity classes, breach-list checking) is a real,
separate feature this ADR declines to invent speculatively --
CLAUDE.md §12's standing instruction against unrequested scope applies here.

### 6. `docs/PRE-LAUNCH-CHECKLIST.md` item 1 (ADR 0015 audit) is unaffected

The external-audience error-message work done earlier this session already
covers every action reachable from `(client-portal)`/`(partner-desk)`,
independent of which auth mechanism reached them. No new external-facing
action is added by this ADR (`invite-staff-user.ts` is owner-only, internal;
`provisionExternalUser`'s caller, `inviteVendorUserAction`, was already
`audience: 'external'`... actually staff-facing, since only staff invite
vendors -- unaffected either way, kept at `'staff'` since the caller is
always a signed-in staff member, never the vendor themselves).

## Consequences

**What this makes easy:** one familiar id+password UX across every role,
matching the Owner's other dashboard; a real (if minimal) staff-management
feature that did not exist before; forgot-password stays a low-volume email
path rather than a rebuilt one.

**What this accepts as a cost:** a generated password must be relayed
out-of-band by whoever invites the user (no email delivery for it) --
acceptable because that relay (WhatsApp/verbal) is already this project's
default communication channel with field/external roles, and because it
removes password delivery from the same SMTP constraint blocking magic link
at volume. No forced password change on first login and no complexity
policy -- both real, deliberately deferred scope, noted below.

**Reversal cost:** low. `signInWithOtp` remains available on the Supabase
project (nothing about enabling password auth disables it) if a future ADR
wants a hybrid; the removed `core/auth/magic-link.ts` is recoverable from git
history, not a schema change.

## Alternatives considered

- **Keep magic link, fix the SMTP rate-limit instead**: this was offered to
  the Owner explicitly as the likely fix for the bug encountered earlier in
  the session, and rejected -- confirmed the request was a UX preference for
  password auth specifically, not a workaround.
- **Force a password change on first login**: rejected for this pass as
  unrequested scope; noted in `docs/PRE-LAUNCH-CHECKLIST.md` as a real,
  cheap follow-up once real external users exist.
- **Send the generated password by email anyway**: rejected -- reintroduces
  the exact SMTP dependency this change was partly motivated to reduce, for
  no benefit over relaying it directly.
