/**
 * Public API of modules/quality-gate. The only door other modules and app/
 * may use to reach hold_point_templates, inspections, or nonconformities
 * (ARCHITECTURE.md 1.2) -- one module owns all three tables (ARCHITECTURE.md 1.1).
 */

export type {
  Blocked,
  CashGateStatus,
  HoldPointState,
  HoldPointTemplate,
  HoldPointTemplateUpdate,
  Inspection,
  InspectionUpdate,
  NewHoldPointTemplate,
  NewInspection,
  NewNonconformity,
  Nonconformity,
  NonconformityUpdate,
  Proceed,
  WorkPackageState,
} from './types';

export {
  createHoldPointTemplateSchema,
  createInspectionSchema,
  createNonconformitySchema,
  overrideInspectionSchema,
  recordInspectionResultSchema,
  resolveNonconformitySchema,
  updateHoldPointTemplateSchema,
  type CreateHoldPointTemplateInput,
  type CreateInspectionInput,
  type CreateNonconformityInput,
  type OverrideInspectionInput,
  type RecordInspectionResultInput,
  type ResolveNonconformityInput,
  type UpdateHoldPointTemplateInput,
} from './schemas';

export {
  createHoldPointTemplateAction,
  listHoldPointTemplatesAction,
  updateHoldPointTemplateAction,
} from './actions/hold-point-template-actions';
export {
  createInspectionAction,
  getWorkPackageProceedStatusAction,
  listHoldPointStatusForWorkPackageAction,
  listInspectionsForWorkPackageAction,
  overrideInspectionAction,
  recordInspectionResultAction,
} from './actions/inspection-actions';
export {
  createNonconformityAction,
  listNonconformitiesForInspectionAction,
  resolveNonconformityAction,
} from './actions/nonconformity-actions';
