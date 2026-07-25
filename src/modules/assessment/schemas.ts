import { z } from 'zod';

/**
 * Zod only at the boundary (CLAUDE.md 3) -- these validate action input
 * shape, not the business rule that `completed` needs an assessor (that is
 * `ck_assessments_completed_requires_assessor`, enforced by the database and
 * satisfied server-side by completeAssessmentAction itself, never by client
 * input).
 */

export const createAssessmentSchema = z.object({
  siteId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  siteConditions: z.string().trim().max(5000).optional(),
  recommendedScope: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

/** Phase 3 (F17): a consistency aid, not a completion gate -- any subset of the standard checklist keys may be present, and this is validated only at this boundary, never re-checked against the fixed item list elsewhere. */
const assessmentChecklistResponsesSchema = z.record(z.string(), z.boolean());

export const updateAssessmentFindingsSchema = z.object({
  id: z.string().uuid(),
  siteConditions: z.string().trim().max(5000).optional(),
  recommendedScope: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
  checklistResponses: assessmentChecklistResponsesSchema.optional(),
});
export type UpdateAssessmentFindingsInput = z.infer<typeof updateAssessmentFindingsSchema>;

export const completeAssessmentSchema = z.object({
  id: z.string().uuid(),
});
export type CompleteAssessmentInput = z.infer<typeof completeAssessmentSchema>;
