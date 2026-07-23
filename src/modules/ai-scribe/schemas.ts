import { z } from 'zod';

/**
 * Zod only at the boundary (CLAUDE.md 3). generateIssueClassificationSchema
 * takes the free text the user has just typed into the create-issue form --
 * the issue does not exist yet, so there is no id to fetch by (ADR 0020
 * SS5's "an id, not free-form content" rule is about *other* modules'
 * already-persisted records; this is the one feature that inherently
 * classifies a draft the user is about to submit through createIssueAction
 * anyway). Same length limits as createIssueSchema, so nothing reaches
 * Claude that couldn't already reach the issues table moments later.
 */
export const generateIssueClassificationSchema = z.object({
  title: z.string().trim().min(1, 'Judul masalah wajib diisi').max(300),
  description: z.string().trim().max(5000).optional(),
});
export type GenerateIssueClassificationInput = z.infer<typeof generateIssueClassificationSchema>;

/** An id, reading an already-persisted record through modules/projects' own public API (ADR 0020 SS5). */
export const generateDelayDetectionSchema = z.object({
  projectId: z.string().uuid(),
});
export type GenerateDelayDetectionInput = z.infer<typeof generateDelayDetectionSchema>;

/** An id, reading through modules/procurement's own public API (ADR 0020 SS5). */
export const generateQuoteSummarySchema = z.object({
  vendorQuoteId: z.string().uuid(),
});
export type GenerateQuoteSummaryInput = z.infer<typeof generateQuoteSummarySchema>;

/** An id, reading through modules/assessment's own public API (ADR 0020 SS5). */
export const generateAssessmentScopeDraftSchema = z.object({
  assessmentId: z.string().uuid(),
});
export type GenerateAssessmentScopeDraftInput = z.infer<typeof generateAssessmentScopeDraftSchema>;
