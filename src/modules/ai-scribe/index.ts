/**
 * Public API of modules/ai-scribe (ADR 0020). The only door other modules
 * and app/ may use to reach ai_generations -- nothing under data/, domain/,
 * or actions/ is ever imported directly from outside this folder.
 *
 * Every action here returns a suggestion only. None of them write to any
 * table this module does not itself own (ADR 0020 SS2) -- there is no
 * "approve" path here to accidentally expose.
 */

export type { AiFeature, AiGeneration, NewAiGeneration } from './types';

export {
  generateAssessmentScopeDraftSchema,
  generateDelayDetectionSchema,
  generateIssueClassificationSchema,
  generateQuoteSummarySchema,
  type GenerateAssessmentScopeDraftInput,
  type GenerateDelayDetectionInput,
  type GenerateIssueClassificationInput,
  type GenerateQuoteSummaryInput,
} from './schemas';

export { AI_MONTHLY_BUDGET_CAP, isOverBudget } from './domain/budget-cap';
export { detectOverdueMilestones, type MilestoneDueInput, type OverdueMilestone } from './domain/delay-detection';

export {
  generateIssueClassificationAction,
  type IssueClassificationSuggestion,
} from './actions/issue-classification-actions';

export { generateDelayDetectionAction, type DelayDetectionResult } from './actions/delay-detection-actions';

export { generateQuoteSummaryAction, type QuoteSummaryResult } from './actions/quote-summary-actions';

export {
  generateAssessmentScopeDraftAction,
  type AssessmentScopeDraftResult,
} from './actions/assessment-scope-draft-actions';
