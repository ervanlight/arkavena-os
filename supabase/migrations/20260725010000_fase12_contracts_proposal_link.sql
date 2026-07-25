-- Fase 12 prep (IMPLEMENTATION_PLAN.md Phase 2, F7). `contracts` (owned by
-- modules/projects, Wave 2) gains a nullable link back to the `proposals`
-- row (owned by modules/estimating, Wave 5-6) it was negotiated from.
--
-- Why this matters (ARCHITECTURE_REVIEW.md / WORKFLOW_REVIEW.md, both
-- verified): today there is no way to trace a signed contract back to the
-- specific proposal a client actually agreed to -- if a client later
-- disputes "that's not what I agreed to," the audit chain breaks exactly
-- at this boundary. Nullable and RESTRICT-on-delete: a contract created
-- before this column existed, or one negotiated without a formal proposal
-- record, is still valid with no link.
--
-- Cross-module FK (projects -> estimating) is fine here: both tables
-- already exist (this runs after Wave 11), so there is no "FK to a higher
-- wave" ordering problem -- that rule only constrains original build-out
-- order, not a new migration added after every wave is already applied.

alter table contracts
  add column proposal_id uuid references proposals (id) on delete restrict;

create index idx_contracts_proposal_id on contracts (proposal_id) where deleted_at is null;

comment on column contracts.proposal_id is
  'Nullable link to the proposals row (modules/estimating) this contract was negotiated from. Added post-hoc (Fase 12 prep) -- contracts predating this column, or negotiated without a formal proposal, are still valid with proposal_id null.';
