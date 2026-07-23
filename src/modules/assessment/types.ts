import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/**
 * Row types always derive from the generated schema (ARCHITECTURE.md 3.1).
 * No money column here -- assessments carry no pricing (ADR 0018 SS3), so
 * unlike modules/crm's Lead there is nothing to re-brand as Rupiah.
 */

export type Assessment = Tables<'assessments'>;
export type NewAssessment = TablesInsert<'assessments'>;
export type AssessmentUpdate = TablesUpdate<'assessments'>;
