/**
 * Public API of modules/evidence (ADR 0026 §3, ADR 0029). The only door
 * other modules and app/ may use to reach `evidence` or `evidence_overrides`
 * -- this module owns both tables (ARCHITECTURE.md 1.1).
 */

export type { Evidence, EvidenceActivityTable, EvidenceOverrideRow, EvidenceWithUrl, NewEvidence } from './types';

export { overrideEvidenceGateSchema, type OverrideEvidenceGateInput } from './schemas';

export {
  listEvidenceForActivityAction,
  listClientVisibleEvidenceForProjectAction,
  listClientVisibleEvidenceWithUrlsForProjectAction,
  listDocumentEvidenceAction,
  listEvidenceOverridesForProjectAction,
  overrideEvidenceGateAction,
} from './actions/evidence-actions';
