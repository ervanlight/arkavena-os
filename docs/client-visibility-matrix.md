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
| Menunggu Anda | `client-portal.listPendingClientDecisionsAction` → `client_decisions` | `client_summary` (fallback to a generic sentence, never `change_orders.title`/`proposals`' internals raw), Decision Clock tier, `change_order_id`/`proposal_id` (only used to build a same-origin link) | Neither `change_orders`' nor `proposals`' other fields are ever read here — client-portal reads only its own `client_decisions` table, synced by trigger from both sources (post-implementation review fix, C1) |
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

**Post-implementation review fix (C2):** the original F2 fix only translated
the status enum — `title`, `description`, `cost_impact_amount`, and
`schedule_impact_days` still rendered raw underneath it, directly
contradicting ADR 0026 §5's explicit wording for `scope-variation`: *"bukan
'Variation Request #24' dengan tabel dampak biaya."* All four fields are now
replaced by `change_orders.client_summary` (staff-authored at
`sendChangeOrderToClientAction` time), the same field this page's own module
already had available but never used. Not shown, ever: `title`, `description`,
`cost_impact_amount`, `schedule_impact_days`.

## F1 — proposal acceptance (`proposals/[id]/decide/page.tsx`, ADR 0026 §5 amendment)

`estimating` stays **Internal Only** for its mechanism (margin, cost breakdown,
`estimates`/`estimate_items`/`cost_library` — untouched, D2.6 protection unchanged).
The narrow decision surface on `proposals` (`status`/`decided_at`/`decided_by`/
`decision_reason`) is now **Client Decision Required**, the same split
`change_orders` already has.

**Post-implementation review fix (C1, ADR 0026 §7 item 7):** F1 originally had
client-portal's app routes import `@/modules/estimating` directly
(`getProposalAction`, `listProposalsForProjectAction`, `clientDecideProposalAction`)
— a violation of ARCHITECTURE.md 1.2's F25 rule (client-portal must never
import cash-gate/estimating directly, "sekalipun untuk satu field yang sudah
diterjemahkan"), found in a post-implementation review, not caught at
implementation time. Corrected so client-portal never imports `@/modules/estimating`
at all, for either reads or writes:

| Field shown | Source | Why safe |
| --- | --- | --- |
| `client_summary` | `client_decisions.client_summary` (synced from `proposals.client_summary` by `fn_proposals_sync_client_decision`, not read from `proposals` directly) | Never the estimate/cost breakdown — same pattern as `change_orders.client_summary` |
| Status (mapped to a sentence, e.g. "menunggu keputusan Anda") | `client_decisions.decision`/`decided_at` (not `proposals.status`) | Raw enum never interpolated (same discipline as F2's fix) |

The client's own accept/reject goes through `fn_client_decide_proposal`, a plain
(non-`security definer`) database RPC called by `modules/client-portal`'s own
action via `supabase.rpc(...)` — a named procedure call, not a TypeScript
import across the boundary, mirroring how `modules/evidence`'s
`fn_override_evidence_gate` already crosses a cross-cutting mutation boundary.
`proposals_update_client` RLS and the two guard triggers built for F1
(`fn_proposals_guard_transition`, `fn_proposals_guard_client_columns`) keep
enforcing exactly as before, unchanged.

Not shown, ever: `estimate_id`, any cost/margin figure, `estimate_items`,
`cost_library`. RLS (`proposals_select_client`, still the real gate underneath
`client_decisions`) hides a `draft` proposal entirely — a client never sees a
proposal still being prepared, and client-portal never queries `proposals`
to find that out.

## F3 — invoice/payment-due visibility (`portal/[projectId]/page.tsx`, milestone 2.4)

`billing` stays **Internal + Management** for its mechanism (aging dashboard, DSO,
collections analytics — untouched). ADR 0026 §5's own wording names the one
allowed slice: *"ada tagihan yang perlu dibayar, jatuh tempo tanggal X"* — a plain
notification inside "Menunggu Anda", not a billing surface of its own.

RLS (`invoices_select_client`) and `core/permissions/matrix.ts`'s `invoice.view`
already included `client_approver`/`client_viewer` before this milestone (built
ahead of the UI, Wave 8/9) — F3 needed no new migration or permission-matrix
change, only wiring `listInvoicesForProjectAction` (already client-callable) into
the Timeline shell, filtered to `status = 'issued'`.

| Field shown | Source | Why safe |
| --- | --- | --- |
| `amount` (formatted Rupiah) | `invoices.amount` | No margin/cost column exists on this table at all |
| `due_date` | `invoices.due_date` | A real date is appropriate here (unlike "Akan Datang"'s milestones) — a payment due date is a commitment already made, not a schedule estimate that could slip |

Not shown: aging tier, DSO, `milestone_id`/`change_order_id` linkage, `payments`
history. A `draft` invoice is invisible (RLS `status <> 'draft'`); a `paid` or
`cancelled` invoice simply stops appearing in "Menunggu Anda" (filtered client-side
to `status = 'issued'`), same "settled, no longer an action item" reasoning as a
decided `client_decision`.
