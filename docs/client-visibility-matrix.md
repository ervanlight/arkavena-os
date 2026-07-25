# Client Visibility Matrix

Companion to `docs/rls-matrix.md` (ARCHITECTURE_REVIEW.md's "Documentation" finding,
`IMPLEMENTATION_PRIORITIES.md` F28). `rls-matrix.md` answers "which role can read
which row"; this document answers a narrower, client-specific question: **for
everything a client-facing surface exposes, exactly which columns/fields does it
show, where do they come from, and why is that safe** — so confirming "does this
leak anything it shouldn't" never again requires reading migration SQL directly.

Written incrementally as each client-facing surface ships (F28 is ongoing per
`IMPLEMENTATION_PLAN.md` 2.7), not all at once. This entry covers milestone 2.1
(F5's Client Timeline shell) plus F2 (variation status translation), which shipped
just before it.

## Client Timeline shell (`portal/[projectId]/page.tsx`, ADR 0026 §4.1)

Replaced the old Ringkasan/Timeline/Zona/Foto/Keputusan tabs (ADR 0026 §4.1).
`laporan-mingguan` is untouched — ADR 0026 names exactly those five as replaced.

| Section | Source (module's public API) | Fields shown | Why safe |
| --- | --- | --- | --- |
| Status | `client-portal.listClientStatusUpdatesForProjectAction` → `client_status_updates` | `status`, `headline`, `detail`, `published_at` | Table is staff-authored specifically for client display (ADR 0026 §2); no internal columns exist on it to accidentally leak |
| Menunggu Anda | `client-portal.listPendingClientDecisionsAction` → `client_decisions` | `client_summary` (fallback to a generic sentence, never `change_orders.title` raw), Decision Clock tier, `change_order_id` (only used to build a same-origin link) | `change_orders.title`/`description`/cost fields are never read here — ADR 0026 §4.2's whole reason for adding `client_summary` |
| Hari Ini / Update Terbaru (evidence) | `evidence.listClientVisibleEvidenceWithUrlsForProjectAction` → `evidence` | signed `thumbnailUrl` (1-hour TTL), `captured_at` | Filtered server-side to `visibility = 'client_visible'` (RLS `evidence_select_client`, ADR 0026 §3/ADR 0029); `activity_table`/`activity_id`/`storage_path` never leave the repository layer |
| Minggu Ini | Derived in-page from the same evidence + status rows above | Counts and headlines only | No new data source; no percentage/ratio computed (ADR 0026 §4.3) |
| Akan Datang | `client-portal.listClientTimelineEventsAction` → `vw_client_timeline_event`, filtered to `event_type = 'milestone'` | `title` (milestone name, staff-authored), a relative window ("minggu ini"/"minggu depan"/"beberapa minggu lagi") | Never shows an exact date for anything not yet due (ADR 0026 §4.2: "tanpa tanggal pasti kalau berisiko meleset") |
| Update Terbaru (milestones + decisions) | `client-portal.listClientTimelineEventsAction` → `vw_client_timeline_event` | `title` (decision events prefer `client_summary`, see migration `20260725050000`), `event_at`, `status` | `security_invoker = true` view; RLS on `client_decisions`/`milestones` is the real gate, not the view |

### What this shell deliberately does not show (ADR 0026 §4.3)

No progress percentage, no open-issue counts, no cash/funding ratios, no raw
internal enum values, no table/list of any technical module. General zone photos
with no specific `work_package_id`/`daily_log_id`/`handover_item_id` are not
promoted to `evidence` at all (ADR 0029 Decision 3) and so do not appear here —
an intentional scope narrowing, not a bug.

## F2 — variation approval status (`variations/[id]/approve/page.tsx`)

Replaced a raw `change_order_status` enum interpolation with a
`STATUS_LABEL_ID` map to an Indonesian sentence. No new data source; the fix was
presentation-only (see ARCHITECTURE_REVIEW.md's "one concrete philosophy
violation already shipped").

## Still to document here as they ship

- F1 (proposal acceptance) — milestone 2.3
- F3 (invoice/payment-due visibility) — milestone 2.4
