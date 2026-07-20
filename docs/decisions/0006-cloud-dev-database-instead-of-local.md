# ADR 0006 — Development targets the Supabase Cloud project directly, not a local stack

**Status:** Accepted
**Date:** 2026-07-20
**Needs owner confirmation:** no (this ADR records the owner's own decision)

## Context

ARCHITECTURE.md §7 and CLAUDE.md §10 assume `supabase start` -- a full local
Postgres, Auth, Storage and Realtime stack running in Docker on the developer's
machine. That assumption broke in practice, not in theory.

The owner's Mac has under 1GB of free disk. Getting a local Supabase running
required a container runtime, and the two paths both failed for reasons rooted
in the same constraint:

- **Colima** needs QEMU on this Intel Mac running macOS 12 (no `vz` backend).
  Homebrew no longer ships a QEMU bottle for macOS 12, so it had to build from
  source through OpenSSL, Python, and GLib -- over an hour, and it was still
  building when abandoned.
- **Docker Desktop**, installed instead, hit the actual wall: pulling the
  Postgres image failed with `read-only file system` on containerd's metadata
  store, because the host disk had almost nothing left. This was never a
  Docker problem or a network problem; disk cleanup only clawed back to single
  digits of GB free.

Waiting out a from-source QEMU build, or fighting a host machine that is
structurally out of room, is not a reasonable price for local development
infrastructure. The owner made the call: stop running anything locally, and
develop directly against a Supabase Cloud project.

## Decision

Local development targets the `buildtrust-os-dev` Supabase Cloud project (free
tier) instead of a Docker-based local stack.

- `supabase link --project-ref rwdftlsbdkcktoeeixle` replaces `supabase start`.
- `supabase db push` replaces `supabase db reset --local` for applying
  migrations. Migrations remain append-only exactly as before -- this changes
  where they are applied, not the rule that they are never edited after the
  fact.
- `pnpm db:types` generates from the linked cloud project (`--linked`) instead
  of `--local`.
- The `db` Vitest project (`supabase/tests/**`) runs against the same cloud
  project, using the **direct** connection (port 5432), never the transaction
  pooler (port 6543). The pooler multiplexes statements across physical
  connections, and `supabase/tests/db.ts` depends on `set_config` persisting
  across statements within one client connection to impersonate a signed-in
  user for RLS tests -- through the pooler that state can silently vanish
  between statements, which would make RLS tests fail intermittently for a
  reason that has nothing to do with RLS.
- Docker is no longer part of this project's toolchain for the developer
  machine. Nothing in Fase 0 needs it locally.
- **CI is unaffected.** `.github/workflows/ci.yml` still runs `supabase start`
  inside the GitHub Actions runner, which has its own disk entirely separate
  from the owner's laptop. CI staying on an ephemeral local stack -- rather
  than also pointing at the cloud dev project -- is deliberate: a CI run that
  wrote to a shared database would make two pull requests running at once
  corrupt each other's test data.

## Consequences

**The dev database is shared and mutable state, not a disposable sandbox that
resets on `git checkout`.** Every `db push` and every `test:db` run acts on the
same remote database. The RLS test suite creates two organisations and cleans
up after itself (`cleanupOrganizations`), but a crashed test run or a manual
`Ctrl+C` mid-test can leave rows behind. The owner has accepted this
explicitly: the project is disposable and may be reset or truncated at will
because nothing in it is production data. If that stops being true --the
moment any real project or client data touches this project -- this decision
needs revisiting before anything else does.

**Owner decision D9's free-tier limits start accumulating from local
development now, not only from a deployed staging environment.** Every
`db push`, every test run, every magic link sent counts against the same
500MB database / 1GB storage / auto-pause-after-7-days budget that production
would use. This makes D9's instruction to flag anything approaching a limit
more urgent, not less: there is now only one free-tier budget, and local
development spends from it too.

**A leaked credential is a shared-project incident, not a wipe-and-reclone.**
The `.env.local` holding the DB password and anon key must stay out of git
(enforced by `.gitignore`, verified below) and out of chat history where
avoidable, because rotating it means everyone's local setup breaks until they
update it, not just one machine's.

**Local development loses per-run isolation.** A local ephemeral stack gives
every `supabase db reset` a blank slate; a shared cloud project does not.
Anyone working on this codebase at the same time is reading and writing the
same rows during that overlap. For a single-developer Fase 0 this is a cost
worth paying; it is worth revisiting before more than one person is pushing
migrations against the same project.

## Alternatives considered

**Wait for the QEMU build to finish.** Rejected: over an hour already spent for
a dependency chain with no guaranteed end, to solve a problem (disk space) that
QEMU does not actually fix -- Docker Desktop hit the same disk wall Colima
would have.

**A smaller local-only stack (Postgres alone, no Auth/Storage/Realtime
containers).** Would have reduced disk pressure but not eliminated it, and it
would have meant writing and maintaining a second, thinner version of the local
environment purely for one developer's disk constraint. The cloud project
needed to exist anyway for staging; using it now instead of inventing a
second local variant is less total complexity.

**A different cloud provider's free Postgres, with Supabase Auth pointed
elsewhere.** Rejected without much consideration: it would split Auth and
Storage away from the database they are meant to sit beside, entirely to dodge
a disk-space problem that has nothing to do with either.

## Addendum, same day: three things this decision did not anticipate

Getting the cloud project actually working surfaced three more container- and
platform-shaped problems, each fixed without reopening the core decision above.

**1. The direct connection is IPv6-only on this tier, and this network has no
IPv6 route at all.** `db.<ref>.supabase.co` resolves to an AAAA record only --
Supabase's free tier does not include the IPv4 add-on for direct connections.
`dig` confirmed no A record; a raw TCP connect attempt to the AAAA address
returned `EHOSTUNREACH`; `netstat -rn` showed no IPv6 default route on this Mac
at all, only link-local addresses on VPN tunnel interfaces. Not a firewall, not
a timeout to retry -- this network cannot reach that address, full stop.

The fix is the **Session pooler** (port 5432 on `aws-0-<region>.pooler.
supabase.com`, username `postgres.<ref>`), not the Transaction pooler (port
6543) the earlier version of this document warned away from. Session mode
keeps one dedicated backend per client connection for the connection's
lifetime, which is the same guarantee a direct connection gives and exactly
what `supabase/tests/db.ts`'s `set_config`-based user impersonation needs; it
was verified empirically (`set_config` in one statement, `current_setting` in
the next, on the same `pg.Client`, returned the value that was set) before
relying on it. Transaction mode would not have given that guarantee. `.env.
local` and `supabase/tests/db.ts` both document this.

**2. `supabase gen types typescript --db-url` shells out to a Docker/Podman
container running `postgres-meta` to do the introspection.** This is not
documented anywhere obvious, and it directly reintroduces the container
dependency this whole ADR exists to remove -- `--db-url` looks like a pure SQL
client operation and is not one. It failed with a Podman-not-found error, and
because the command redirects stdout to a file, that failure -- including the
full database password, in the connection string, in plain text -- got written
into `src/core/db/database.types.ts`, a file tracked by git. It was caught and
overwritten before a commit, and `git log --all -p` on that path confirmed the
password never entered history, but the near-miss is the reason
`src/core/db/database.types.ts` should never again be generated by redirecting
a command's stdout straight into it without checking the exit code and the
content first.

The fix is `supabase gen types typescript --project-id <ref> --schema public`,
which calls Supabase's Management API instead and needs no local container --
at the cost of a Personal Access Token (`SUPABASE_ACCESS_TOKEN`), a credential
with a materially larger blast radius than the DB password: it is scoped to
the owner's entire Supabase account, not this one project. The owner chose this
over a hand-rolled `information_schema` introspection script specifically to
avoid taking on a schema-type generator as a permanent maintenance burden for
the rest of the project's life; the token is revocable any time from
supabase.com/dashboard/account/tokens once it is no longer needed.

**3. `boundaries/alias` does nothing in eslint-plugin-boundaries v7.** It was
configured first, produced no error, and `pnpm lint` passed -- but
`scripts/verify-boundaries.ts` (written for exactly this reason: a linter that
silently stops enforcing something looks identical to a clean run) showed 5 of
14 boundary checks were not actually firing. Reading the plugin's compiled
source (`Settings/Settings.js`, `deprecateAlias`) confirmed why: the setting
only emits its own deprecation warning and resolves nothing. Every `@/...`
import in this codebase was being classified as an external package, which
silently allowed every cross-module and app-into-module-internals violation
(swept into "third-party is unrestricted") and silently blocked legitimate
local imports from `domain/` (swept into "no infrastructure"). The fix is
`import/resolver` with `eslint-import-resolver-typescript` as a direct
devDependency -- not the transitive copy already pulled in by
`eslint-config-next`, which would make this break again, silently, on an
unrelated dependency bump. All 14 checks hold with this in place.

The common thread across all three: each one would have shipped silently
broken -- a leaked password sitting in a tracked file, an unreachable database
nobody would have understood was a network issue, an ESLint config that looked
correct and enforced almost nothing -- if nothing had been running the actual
command and inspecting the actual result. Read the tool's own source before
guessing at its settings, and verify a security boundary by trying to break it,
not by reading the config and believing it.
