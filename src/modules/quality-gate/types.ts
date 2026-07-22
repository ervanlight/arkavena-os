import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

export type { Blocked, CashGateStatus, HoldPointState, Proceed, WorkPackageState } from './domain/types';

/** Reusable hold-point definitions, keyed by work_type -- data, not code (ADR 0014). No money columns. */
export type HoldPointTemplate = Tables<'hold_point_templates'>;
export type NewHoldPointTemplate = TablesInsert<'hold_point_templates'>;
export type HoldPointTemplateUpdate = TablesUpdate<'hold_point_templates'>;

export type Inspection = Tables<'inspections'>;
export type NewInspection = TablesInsert<'inspections'>;
export type InspectionUpdate = TablesUpdate<'inspections'>;

export type Nonconformity = Tables<'nonconformities'>;
export type NewNonconformity = TablesInsert<'nonconformities'>;
export type NonconformityUpdate = TablesUpdate<'nonconformities'>;
