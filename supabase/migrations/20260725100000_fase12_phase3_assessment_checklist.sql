-- Phase 3 milestone 3.6 (F17): standard assessment checklist/template.
-- WORKFLOW_REVIEW.md 1.2: "every assessment is a free-text notes/
-- site_conditions field... becomes a real gap only once there's more than
-- one assessor and consistency across their reports starts to matter."
--
-- A single nullable jsonb column, not a new table: the standard checklist
-- item set itself is config-as-code (modules/assessment/domain/
-- standard-checklist.ts), not per-organization-customizable data, so there
-- is nothing relational to store beyond "which items did this particular
-- assessment check off." No NOT NULL / completion constraint added --
-- consistency is a nudge for this feature (IMPLEMENTATION_PRIORITIES.md
-- F17: "no evidence of a current consistency problem to justify" a hard
-- gate), not a new hard requirement to complete an assessment.

alter table assessments add column checklist_responses jsonb;

comment on column assessments.checklist_responses is
  'Phase 3 (F17): { [itemKey]: boolean } against the fixed standard checklist in modules/assessment/domain/standard-checklist.ts. Nullable and unenforced -- a consistency aid across assessors, not a completion gate.';
