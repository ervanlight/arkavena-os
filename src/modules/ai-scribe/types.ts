import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert } from '@/core/db/database.types';

/** Row type always derives from the generated schema (ARCHITECTURE.md 3.1). Append-only -- no Update type, same as audit_logs. */

export type AiGeneration = Omit<Tables<'ai_generations'>, 'cost_amount'> & { cost_amount: Rupiah };
export type NewAiGeneration = Omit<TablesInsert<'ai_generations'>, 'cost_amount'> & { cost_amount: Rupiah };

export type AiFeature = 'issue_classification' | 'delay_detection' | 'quote_summary' | 'assessment_scope_draft';
