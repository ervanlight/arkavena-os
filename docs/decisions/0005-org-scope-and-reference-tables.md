# ADR 0005 — How org scope is resolved, and the one table exempt from it

**Status:** Proposed
**Date:** 2026-07-20
**Needs owner confirmation:** **yes** — this touches permissions.

## Context

Owner decision D1 requires `organization_id` and an org-scoped RLS policy on
**every** table from the first migration. Writing Wave 1 surfaced two things D1
does not resolve. Both affect who can see what, so neither was decided quietly.

### Question 1 — where does "the current organisation" come from?

Every org-scoped policy needs to answer "which organisation is this user in?".
ARCHITECTURE.md §6.1 proposes putting `organization_id` into JWT custom claims,
so a policy can read it from the token without a join.

That is genuinely cheaper. It also introduces a second copy of a fact that
already lives in the `users` table, kept in sync by a custom access token hook
plus the provisioning code. Two copies of a security-relevant fact can disagree.
When they disagree, the token wins — and a stale token means a user is scoped to
an organisation they have been moved out of, for as long as the token lives.
That failure is silent and it is the wrong direction: it grants access rather
than denying it.

### Question 2 — the `roles` table has no organisation

`roles` holds the eleven fixed roles from ARCHITECTURE.md §6.1. They are the same
eleven for every organisation; they change only by migration. Giving the table an
`organization_id` would mean eleven duplicate rows per tenant, all identical, all
required to stay identical — a consistency problem invented for the sake of a
column.

## Decision

### 1. `fn_current_org_id()` reads the `users` table, not the JWT

```sql
create function fn_current_org_id() returns uuid
language sql stable security definer
as $$ select organization_id from public.users where id = auth.uid() and deleted_at is null $$;
```

`STABLE` means Postgres evaluates it once per statement, not once per row, so the
per-query cost is a single indexed lookup rather than the per-row join the JWT
approach was avoiding.

`SECURITY DEFINER` is required rather than merely convenient: the RLS policy on
`users` itself calls this function, and without DEFINER that recurses.

Crucially, **every policy calls this function instead of inlining the lookup**.
Moving to JWT claims later is then a change to one function body — not to forty
policies — and can be done once the access token hook exists and has been tested.
The optimisation is deferred, not foreclosed.

### 2. `roles` is a global reference table with no `organization_id`

RLS is still enabled. The policy is: any authenticated user may `SELECT`; there
is no `INSERT`, `UPDATE`, or `DELETE` policy for anyone, so the table changes
only through migrations.

The CI check that enforces "every table has `organization_id`" carries an
explicit allowlist containing exactly this table, with a comment. An exemption
that has to be named in a file that CI reads is visible; one that lives in
someone's memory is not.

## Consequences

**On question 1.** We accept one indexed lookup per statement in exchange for
having a single source of truth for a user's organisation. If profiling later
shows this matters, the fix is contained to one function.

The `deleted_at is null` and `status = 'active'` conditions mean a suspended or
soft-deleted user resolves to `NULL`. Every org-scoped policy compares
`organization_id = fn_current_org_id()`, and in SQL `x = NULL` is `NULL`, not
true — so a suspended user matches no rows anywhere. The system fails closed by
construction rather than by remembering to check.

**On question 2.** The exemption is narrow and the reasoning is written down. The
risk is that "reference table" becomes a habit and later tables claim the
exemption without thinking. Mitigation: the allowlist is a literal list of table
names in the CI check. Adding to it is a visible diff in a pull request, which is
exactly the moment the question should be asked.

## Alternatives considered

**JWT claims now.** Rejected for the staleness failure above, not for the
performance. Revisit alongside the access token hook, with a test proving a
moved user loses access immediately.

**Give `roles` an `organization_id` for uniformity.** Rejected: eleven identical
rows per tenant that must never diverge is a data-integrity problem created
purely to satisfy a rule the rule did not intend to cover.

**Move `roles` out of the public schema.** Cleaner conceptually, but it puts the
table outside generated types and the standard RLS test harness — real cost, for
a naming benefit.
