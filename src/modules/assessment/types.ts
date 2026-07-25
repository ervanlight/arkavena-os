import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';
import type { AssessmentChecklistResponses } from './domain/standard-checklist';

/**
 * Row types always derive from the generated schema (ARCHITECTURE.md 3.1).
 * No money column here -- assessments carry no pricing (ADR 0018 SS3), so
 * unlike modules/crm's Lead there is nothing to re-brand as Rupiah.
 * `checklist_responses` narrowed from the generated `Json` to
 * `AssessmentChecklistResponses` (Phase 3, F17) -- same Omit-and-compose
 * pattern every other column override in this codebase already uses.
 */

export type Assessment = Omit<Tables<'assessments'>, 'checklist_responses'> & {
  checklist_responses: AssessmentChecklistResponses | null;
};
export type NewAssessment = Omit<TablesInsert<'assessments'>, 'checklist_responses'> & {
  checklist_responses?: AssessmentChecklistResponses | null;
};
export type AssessmentUpdate = Omit<TablesUpdate<'assessments'>, 'checklist_responses'> & {
  checklist_responses?: AssessmentChecklistResponses | null;
};
