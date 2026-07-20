# ADR 0007 — Fase 1 includes `sites` and `client_users`, not just the table list in §7

**Status:** Accepted — owner approved on 2026-07-20
**Date:** 2026-07-20
**Needs owner confirmation:** no (this ADR records the owner's own decision)

## Context

ARCHITECTURE.md §7's Fase 1 entry lists its tables explicitly: "Wave 2-6:
clients, projects, project_members, zones, contracts, milestones,
work_packages." Neither `sites` nor `client_users` appears there.

But two other parts of the same document contradict that omission:

- §2.1 (Wave 4) states `projects → organizations, clients, sites` -- `projects`
  has a foreign key to `sites` as part of its own definition, not as an
  optional extra.
- §1.1 assigns `leads, clients, client_users, sites` to the same module,
  `crm`. `sites` and `client_users` are not scattered elsewhere; they sit right
  next to `clients` in the folder structure.

Building `projects` in Fase 1 without `sites` existing means either dropping a
foreign key ARCHITECTURE.md itself specifies, or silently building `sites`
anyway without deciding to. Neither is a call to make silently (CLAUDE.md §11).

## Decision

Fase 1 includes a minimal `sites` and `client_users`, alongside the tables
already listed in §7:

- `sites` -- enough to give `projects.site_id` a real, non-nullable foreign
  key from the start: the columns a location needs to exist and belong to a
  client, not the fuller feature set (site history, multiple contacts, GPS
  metadata) that may arrive later.
- `client_users` -- the join between `users` and `clients`, needed so a
  client-side person can be associated with a client company at all. Fase 1
  does not yet build anything that reads it (the client portal is Fase 6), but
  without it there is no way to model a client contact as anything other than
  an internal user, which is wrong from the first row.

What Fase 1 explicitly still does **not** build: `leads` (lead capture and
scoring is Fase 8's "crm penuh"), and nothing beyond the columns `sites` and
`client_users` need to support `projects` and `client_users` respectively. This
is the narrow reading of "crm(dasar)" -- the tables `projects` structurally
requires, not the module's full feature set pulled forward.

## Consequences

`projects.site_id` is `not null` from its first migration, which is cheaper
than the alternative (nullable now, `not null` added later via an
expand-migrate-contract sequence once Fase 8 lands). The cost paid now is
small: `sites` needs only a handful of columns to exist meaningfully in Fase 1.

The reversal cost, if this turns out to have been the wrong call: low. `sites`
and `client_users` gain more columns in Fase 8 the same way any table gains
columns in a later wave -- an additive migration, not a rework. Nothing about
this decision needs to be undone, only extended.

## Alternatives considered

**`projects.site_id` nullable, defer `sites` entirely to Fase 8.** Rejected:
trades a small, cheap addition now for a guaranteed future migration
(nullable → not null, requiring a backfill step) plus a period where every
project genuinely has no recorded location -- a real gap in a system whose
whole premise is tracking work at physical sites.

**Treat the §7 table list as exhaustive and drop the `sites` foreign key from
`projects` permanently, not just deferred.** Rejected outright: it directly
contradicts §2.1, which is unambiguous that the relationship exists.
