# ADR 0027 — Product renamed from "BuildTrust OS" to "Arkavena OS"

**Status:** Accepted
**Date:** 2026-07-25
**Trigger:** Founder decision, stated directly: "The product name has officially changed... From this point forward, Arkavena OS is the official product name."

## Context

The product was named "BuildTrust OS" from Fase 0 through ADR 0026 (all 26 prior ADRs, `ARCHITECTURE.md`, `CLAUDE.md`, `PRODUCT.md`, every page title, the PWA manifest, and every shell's sidebar wordmark). The name change is a founder decision, not a technical one — no architecture, schema, or behavior changes as a result of this ADR.

## Decision

The product is now **Arkavena OS**. Every current/forward-facing reference in the repository was updated: `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `PRODUCT.md`, `ARCHITECTURE_REVIEW.md`, ADR 0026 (still `PROPOSED` at the time of this rename, actively being drafted the same day — not a locked historical record), every `page.tsx` metadata title, every shell layout's sidebar wordmark, `public/manifest.json`, `public/offline.html`, and the demo seed organization name (`supabase/seed/02_demo_org.sql`: `"BuildTrust Demo"` → `"Arkavena Demo"`, slug `buildtrust-demo` → `arkavena-demo`).

**What was deliberately left unchanged, and why:**

- **ADR 0022 and ADR 0023** (both `Accepted`, dated 2026-07-23, discussing Fase 11/Partner Desk scope) still say "BuildTrust OS" in their body text. These are historical decision records describing what was true *at the time they were written* — under the name that was official then. Rewriting them to say "Arkavena OS" would misrepresent the historical record (as if the product had always been called that), which is exactly the kind of silent rewrite CLAUDE.md's ADR convention exists to prevent. Left untouched.
- **`supabase/migrations/20260721000000_wave2_clients.sql`** (an already-applied migration, containing `BuildTrust`/`BuildTrust OS` only inside two SQL `COMMENT ON` statements) was **not edited**, per CLAUDE.md §2's hard law: *"migration yang sudah applied tidak pernah diedit; perbaiki lewat migration baru."* If the DB-level column/table comments should reflect the new name, that requires a new migration issuing fresh `COMMENT ON` statements — a schema-touching change, out of scope for a pure rename and not requested.

No code behavior changed. No schema changed. No architecture changed. This ADR exists purely so the renaming event itself has a dated, findable record — matching how every other naming/direction change in this project (D4→ADR 0025, D7→ADR 0020) was handled: recorded, not silently absorbed.

## Consequence

Any future reference to "BuildTrust" anywhere in this repository predating 2026-07-25 (in ADR 0022, ADR 0023, or the Wave 2 migration comment) is historical and intentional, not a missed rename. Any *new* documentation, code, or user-facing text going forward uses "Arkavena OS."
